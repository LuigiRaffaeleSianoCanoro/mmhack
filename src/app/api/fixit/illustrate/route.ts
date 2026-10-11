import { IMAGE_MODEL, fallbackSrc, normalizeCategory, type IllustrationResult } from "@/lib/illustration";
import { readTicket } from "@/lib/illustration-ticket";

// Optional, non-blocking repair illustration. Never called for hazardous reports.
export const maxDuration = 60;

const clamp = (v: string | undefined, d: number, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && v ? Math.min(hi, Math.max(lo, n)) : d; };
const DEADLINE_MS = clamp(process.env.FIXIT_IMAGE_DEADLINE_MS, 45_000, 10_000, 55_000); // total server budget (medium JPEG measured ~39s; low ~22s)
const ATTEMPT_MS = clamp(process.env.FIXIT_IMAGE_ATTEMPT_MS, 42_000, 5_000, 55_000); // per-attempt timeout
const MAX_B64 = clamp(process.env.FIXIT_IMAGE_MAX_B64, 3_000_000, 100_000, 6_000_000); // ~2.2 MB JPEG
const QUALITY = ["low", "medium", "high"].includes(process.env.FIXIT_IMAGE_QUALITY ?? "") ? process.env.FIXIT_IMAGE_QUALITY! : "medium"; // low | medium | high
const HAZARD = /\b(gas|spark|sparking|burning|smoke|shock|exposed wire|carbon monoxide|flood(ing)?|sewage|sagging)\b/i;

class Retryable extends Error {}

async function attempt(prompt: string, ms: number): Promise<string> {
  const base = (process.env.NEON_AI_GATEWAY_BASE_URL ?? "").replace(/\/$/, "");
  if (!base || !process.env.NEON_AI_GATEWAY_TOKEN) throw new Error("image endpoint not configured");
  let res: Response;
  try {
    res = await fetch(`${base}/openai/v1/responses`, {
      method: "POST",
      signal: AbortSignal.timeout(ms),
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}` },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        input: prompt,
        tools: [{ type: "image_generation", output_format: "jpeg", quality: QUALITY, size: "1024x1024" }],
        tool_choice: { type: "image_generation" },
      }),
    });
  } catch (e) {
    const name = (e as Error).name;
    throw new Retryable(name === "TimeoutError" || name === "AbortError" ? `timeout after ${ms}ms` : `network: ${(e as Error).message}`);
  }
  if (res.status >= 500 || res.status === 429) throw new Retryable(`gateway ${res.status}`);
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_B64 * 1.1) throw new Error(`oversized response (${text.length} bytes)`);
  const json = JSON.parse(text) as { output?: { type: string; result?: string }[] };
  const b64 = json.output?.find((o) => o.type === "image_generation_call" && o.result)?.result;
  if (!b64) throw new Error("no image in response");
  if (b64.length > MAX_B64) throw new Error(`oversized image (${b64.length} b64 chars)`);
  return b64;
}

export async function POST(req: Request) {
  const t0 = performance.now();
  const raw = (await req.json().catch(() => null)) as { category?: string; ticket?: string; simulate?: string } | null;
  const ms = () => Math.round(performance.now() - t0);
  const ticket = readTicket(raw?.ticket);
  // No valid server ticket: never spend image budget; show the labelled pre-generated sample.
  if (!ticket) return Response.json({ status: "fallback", src: fallbackSrc(normalizeCategory(raw?.category)), reason: "Pre-generated sample (no live generation for this request).", latencyMs: ms(), attempts: 0 } satisfies IllustrationResult);
  const body = { ...ticket, hazard: false, simulate: process.env.VERCEL_ENV === "production" ? undefined : raw?.simulate };
  const category = normalizeCategory(body.category);
  const summary = String(body.summary ?? "").replace(/[^\p{L}\p{N} ,.'-]/gu, " ").slice(0, 300);
  const reply = (r: IllustrationResult) => Response.json(r);

  // Never illustrate hazardous or uncertain cases (defense in depth; /api/fixit also suppresses).
  if (body.hazard || category === "gas" || category === "electrical" || HAZARD.test(summary))
    return reply({ status: "unavailable", reason: "Suppressed: hazardous or uncertain case.", latencyMs: ms(), attempts: 0 });
  // Bundled sample: pre-generated JPEG, no image API call.
  if (body.mode === "sample") return reply({ status: "fallback", src: fallbackSrc(category), reason: "Sample photo: pre-generated illustration.", latencyMs: ms(), attempts: 0 });

  const prompt = `Calm, flat editorial illustration of a renter's ${category} repair situation: ${summary || category}. Muted warm palette, simple shapes, no text, no hands holding tools, not a how-to diagram.`;
  let attempts = 0;
  let reason = "unknown";
  while (DEADLINE_MS - ms() > 8_000) {
    attempts++;
    try {
      if (body.simulate === "timeout") throw new Retryable("timeout (simulated)");
      if (body.simulate === "504") throw new Retryable("gateway 504 (simulated)");
      if (body.simulate === "oversized") throw new Error("oversized response (simulated)");
      const b64 = await attempt(prompt, Math.min(ATTEMPT_MS, DEADLINE_MS - ms()));
      return reply({ status: "live", src: `data:image/jpeg;base64,${b64}`, model: IMAGE_MODEL, latencyMs: ms(), attempts });
    } catch (e) {
      reason = (e as Error).message.slice(0, 120);
      if (!(e instanceof Retryable) || attempts >= 2) break;
    }
  }
  return reply({ status: "fallback", src: fallbackSrc(category), reason: `Live generation failed (${reason}); showing a pre-generated sample.`, latencyMs: ms(), attempts });
}
