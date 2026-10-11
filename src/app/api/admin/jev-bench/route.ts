import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { jevTriage, JEV_MODEL, JEV_TIMEOUT_MS } from "@/lib/jev";

// TEMPORARY (remove after the Jev bench): runs raw Jev and gpt-5-mini side by side on the production keys.
// Only the sha256 of a random bench token lives in the repo. Returns 404 for anyone else.
export const maxDuration = 300;
const SHA = "ff34caaceef996ab0b6ae58fc19fde410210e774c002ad16626ea8d1d80de8a0";
const ok = (t: string | null) => { const a = Buffer.from(createHash("sha256").update(t ?? "").digest("hex")), b = Buffer.from(SHA); return a.length === b.length && timingSafeEqual(a, b); };
const gateway = createOpenAI({ baseURL: `${(process.env.NEON_AI_GATEWAY_BASE_URL ?? "").replace(/\/$/, "")}/v1`, apiKey: process.env.NEON_AI_GATEWAY_TOKEN, name: "neon-gateway" });

export async function POST(req: Request) {
  if (!ok(req.headers.get("x-bench-token"))) return new Response("not found", { status: 404 });
  const { cases } = (await req.json()) as { cases: string[] };
  const out = [];
  for (const text of cases.slice(0, 20)) {
    const row: Record<string, unknown> = { text };
    let t = performance.now();
    try { const j = await jevTriage(text, false); row.jev = { ...j.triage, model: j.model, latencyMs: j.latencyMs, confidence: j.confidence, hazardP: j.hazardP }; }
    catch (e) { row.jev = { error: String((e as Error).message).slice(0, 160), latencyMs: Math.round(performance.now() - t) }; }
    t = performance.now();
    try {
      const r = await generateText({ model: gateway.chat("gpt-5-mini"), providerOptions: { "neon-gateway": { reasoningEffort: "minimal" } },
        prompt: `Classify this renter home-repair report. Reply ONLY JSON {"category":"plumbing|electrical|gas|appliance|hvac|pest|structural|general","urgency":"low|medium|high|emergency","hazard":boolean (true for gas, electrical, fire, flooding, CO),"summary":"<12 words","lang":"language name of the user's text, default English"}.\nReport: ${text}` });
      const s = r.text; row.mini = { ...JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)), latencyMs: Math.round(performance.now() - t) };
    } catch (e) { row.mini = { error: String((e as Error).message).slice(0, 160), latencyMs: Math.round(performance.now() - t) }; }
    out.push(row);
  }
  return NextResponse.json({ jevModel: JEV_MODEL, timeoutMs: JEV_TIMEOUT_MS, keyPresent: !!process.env.TYPESAFE_API_KEY, flag: process.env.FIXIT_JEV_TRIAGE ?? null, rows: out }, { headers: { "cache-control": "no-store" } });
}
