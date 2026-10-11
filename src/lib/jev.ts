import { z } from "zod";
import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";

/**
 * Optional raw-Jev triage via TypeSafe SystemOne (POST https://api.typesafe.ai/v1/systemone, model jev-latest).
 * This is NOT OpenRouter's typesafe/jev-router (a model picker). Primary triage whenever TYPESAFE_API_KEY is set
 * (Oct 11 2026 bench: 24/24 hazard runs caught, same as gpt-5-mini). Kill switch: FIXIT_JEV_TRIAGE=0.
 * Any error, timeout, malformed or low-confidence answer throws, and the caller falls back to gpt-5-mini.
 */
export const JEV_MODEL = process.env.TYPESAFE_MODEL ?? "jev-latest";
// Clamped to 500-2500 ms so a slow provider always leaves budget for the gpt-5-mini fallback.
const rawTimeout = Number(process.env.TYPESAFE_TIMEOUT_MS ?? 2500);
export const JEV_TIMEOUT_MS = Number.isFinite(rawTimeout) ? Math.min(2500, Math.max(500, rawTimeout)) : 2500;
export const JEV_MIN_CONFIDENCE = 0.6;
/** P(hazard) at or above this is a hazard (safety stop). Bench: real hazards scored 0.86-0.98. */
export const JEV_HAZARD_THRESHOLD = 0.7;
/** P(hazard) below this is "no hazard". In between, Jev is unsure and gpt-5-mini decides (bench: benign washer/thermostat scored 0.30-0.42). */
export const JEV_SAFE_THRESHOLD = 0.3;

/** Not the stop list (HAZARD in route.ts is). Broader on purpose: a miss only hands the call to gpt-5-mini.
 * Jev may only raise a hazard when the report itself contains hazard evidence; otherwise gpt-5-mini decides.
 * (Oct 11: sample photo + "This is leaking. What do I do?" got P(hazard) 0.72 with no evidence.) */
export const HAZARD_EVIDENCE = /gas|smell|odou?r|rotten egg|sulfu?r|sulphur|hiss|spark|scorch|burn|smok|fire|flame|crackl|buzz|hot to the touch|warm|flicker|shock|wir(e|ing)|outlet|breaker|carbon monoxide|\bco\b|alarm|detector|headache|dizz|nause|soot|pour|burst|flood|inches of water|sewage|ceiling|collaps|sag|olor|humo|chispa/i;

export const jevEnabled = () => process.env.FIXIT_JEV_TRIAGE !== "0" && !!process.env.TYPESAFE_API_KEY;

const CATEGORIES = ["plumbing", "electrical", "gas", "appliance", "hvac", "pest", "structural", "general"] as const;
const URGENCIES = ["low", "medium", "high", "emergency"] as const;

const Answer = z.object({
  model: z.string().min(1),
  answers: z.object({
    category: z.object({ choice: z.enum(CATEGORIES), confidence: z.number().min(0).max(1) }),
    urgency: z.object({ choice: z.enum(URGENCIES), confidence: z.number().min(0).max(1) }),
    hazard: z.object({ noul: z.number().min(0).max(1) }),
  }),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }).optional(),
});

export type JevTriage = {
  triage: { category: string; urgency: string; hazard: boolean; summary: string };
  model: string;
  latencyMs: number;
  confidence: number;
  hazardP: number;
  usage?: { input: number; output: number };
};

export class JevFallback extends Error {}

export async function jevTriage(text: string, hasPhoto: boolean): Promise<JevTriage> {
  const client = new TypeSafeClient({ defaultModel: JEV_MODEL, timeout: JEV_TIMEOUT_MS, retry: { maxRetries: 0 } });
  const t = performance.now();
  let raw: unknown;
  try {
    raw = await client.systemOne({
      state: { report: text || "(photo only)", photo_attached: hasPhoto },
      questions: {
        category: choice("Which trade does this renter home-repair report need?", Object.fromEntries(CATEGORIES.map((c) => [c, null])) as Record<(typeof CATEGORIES)[number], null>),
        urgency: choice("How urgent is it?", { low: null, medium: null, high: null, emergency: "Danger to people or property right now" }),
        hazard: noul("Is there a safety hazard (gas, electrical, fire, smoke, flooding, carbon monoxide)?"),
      },
    });
  } catch (e) {
    throw new JevFallback(`${(e as Error).name}: ${(e as Error).message}`.slice(0, 80));
  }
  const latencyMs = Math.round(performance.now() - t);
  const p = Answer.safeParse(raw);
  if (!p.success) throw new JevFallback("malformed Jev output");
  const { category, urgency, hazard } = p.data.answers;
  const confidence = Math.min(category.confidence, urgency.confidence);
  if (hazard.noul >= JEV_HAZARD_THRESHOLD && !HAZARD_EVIDENCE.test(text))
    throw new JevFallback(`hazard P ${hazard.noul.toFixed(2)} without hazard evidence in the text after ${latencyMs} ms`);
  const isHazard = hazard.noul >= JEV_HAZARD_THRESHOLD;
  // Unsure about the hazard: let gpt-5-mini decide (it caught every hazard in the bench).
  if (!isHazard && hazard.noul >= JEV_SAFE_THRESHOLD)
    throw new JevFallback(`unsure about hazard (P ${hazard.noul.toFixed(2)}) after ${latencyMs} ms`);
  // Low confidence on a non-hazard answer: don't trust it, use the default triage path.
  if (!isHazard && confidence < JEV_MIN_CONFIDENCE)
    throw new JevFallback(`low confidence ${confidence.toFixed(2)} after ${latencyMs} ms`);
  return {
    triage: { category: category.choice, urgency: urgency.choice, hazard: isHazard, summary: text },
    model: p.data.model,
    latencyMs,
    confidence,
    hazardP: hazard.noul,
    usage: p.data.usage ? { input: p.data.usage.input_tokens, output: p.data.usage.output_tokens } : undefined,
  };
}
