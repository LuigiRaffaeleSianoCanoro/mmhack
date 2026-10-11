import { createHash, timingSafeEqual } from "node:crypto";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { jevTriage } from "@/lib/jev";

// TEMPORARY (remove after benchmarking): Jev vs gpt-5-mini on the 5 bake triage cases.
// Protected by a random token (only its sha256 is in the repo). Returns results only, never keys.
export const maxDuration = 60;
const TOKEN_SHA = "09279279865a3fe1d3455e6c5621f23849483e425df0257be16af06613f45158";
const CASES: [string, string, boolean][] = [
  ["My kitchen faucet keeps dripping even when the handle is fully off.", "plumbing", false],
  ["There's water pooling around the base of my water heater and the pipes on top look corroded.", "plumbing", false],
  ["I smell rotten eggs near the stove and it's getting stronger.", "gas", true],
  ["The outlet behind my TV is warm, has brown scorch marks, and I heard a crackle.", "electrical", true],
  ["My washing machine display shows 'E21' and won't drain.", "appliance", false],
];
const gateway = createOpenAI({ baseURL: `${(process.env.NEON_AI_GATEWAY_BASE_URL ?? "").replace(/\/$/, "")}/v1`, apiKey: process.env.NEON_AI_GATEWAY_TOKEN, name: "neon-gateway" });

export async function POST(req: Request) {
  const got = Buffer.from(createHash("sha256").update(req.headers.get("x-bench-token") ?? "").digest("hex"));
  if (!timingSafeEqual(got, Buffer.from(TOKEN_SHA))) return new Response("not found", { status: 404 });
  const jevKey = !!process.env.TYPESAFE_API_KEY;
  const run = async ([text, cat, stop]: [string, string, boolean]) => {
    const out: Record<string, unknown> = { text: text.slice(0, 40), expected: { cat, stop } };
    let t = performance.now();
    try {
      const j = await jevTriage(text, false);
      out.jev = { model: j.model, ms: j.latencyMs, cat: j.triage.category, hazard: j.triage.hazard, conf: j.confidence, hazardP: j.hazardP, ok: j.triage.category === cat && j.triage.hazard === stop, hazardOk: j.triage.hazard === stop };
    } catch (e) {
      out.jev = { error: String((e as Error).message).slice(0, 100), ms: Math.round(performance.now() - t) };
    }
    t = performance.now();
    try {
      const r = await generateText({ model: gateway.chat("gpt-5-mini"), providerOptions: { "neon-gateway": { reasoningEffort: "minimal" } }, prompt: `Classify this renter home-repair report. Reply ONLY JSON {"category":"plumbing|electrical|gas|appliance|hvac|pest|structural|general","urgency":"low|medium|high|emergency","hazard":boolean (true for gas, electrical, fire, flooding, CO)}.\nReport: ${text}` });
      const g = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1));
      out.mini = { ms: Math.round(performance.now() - t), cat: g.category, hazard: g.hazard, ok: g.category === cat && g.hazard === stop, hazardOk: g.hazard === stop };
    } catch (e) {
      out.mini = { error: String((e as Error).message).slice(0, 100), ms: Math.round(performance.now() - t) };
    }
    return out;
  };
  const rows = await Promise.all(CASES.map(run));
  return Response.json({ jevKeyPresent: jevKey, rows });
}
