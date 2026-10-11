import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { estimateCost } from "@/lib/router";
import type { MMMessage, TraceStep } from "@/lib/trace";

export const maxDuration = 120;

const gateway = createOpenAI({
  baseURL: `${(process.env.NEON_AI_GATEWAY_BASE_URL ?? "").replace(/\/$/, "")}/v1`,
  apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
  name: "neon-gateway",
});
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HAZARD = /\b(gas|spark|sparking|burning|smoke|shock|exposed wire|carbon monoxide|flood(ing)?|sewage|sagging)\b/i;

type Triage = { category: string; urgency: string; hazard: boolean; summary: string };
type Usage = { inputTokens?: number; outputTokens?: number };

export async function POST(req: Request) {
  const { messages, approved }: { messages: MMMessage[]; approved?: boolean } = await req.json();
  const last = messages[messages.length - 1];
  const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
  const images = last.parts.flatMap((p) => (p.type === "file" && p.mediaType.startsWith("image/") ? [p.url] : []));

  const stream = createUIMessageStream<MMMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      const put = (s: TraceStep) => writer.write({ type: "data-trace", id: s.id, data: s });
      const done = (s: TraceStep, t: number, u: Usage) => {
        const known = u.inputTokens != null && u.outputTokens != null;
        put({
          ...s,
          status: "done",
          latencyMs: Math.round(performance.now() - t),
          tokens: known ? { input: u.inputTokens!, output: u.outputTokens! } : undefined,
          costUsd: known ? estimateCost(s.model, u.inputTokens!, u.outputTokens!) : undefined,
        });
      };
      const say = (id: string, delta: string) => {
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta });
        writer.write({ type: "text-end", id });
      };

      // 1. Triage
      const tri: TraceStep = { id: "triage", task: "Triage the problem", model: "gpt-5-mini", provider: "neon-gateway", why: "Short structured classification: smallest reliable model.", status: "running" };
      put(tri);
      let t = performance.now();
      let triage: Triage = { category: "general", urgency: "medium", hazard: false, summary: text };
      try {
        const r = await generateText({
          model: gateway.chat("gpt-5-mini"),
          providerOptions: { "neon-gateway": { reasoningEffort: "minimal" } },
          prompt: `Classify this renter home-repair report. Reply ONLY JSON {"category":"plumbing|electrical|gas|appliance|hvac|pest|structural|general","urgency":"low|medium|high|emergency","hazard":boolean (true for gas, electrical, fire, flooding, CO),"summary":"<12 words"}.\nReport: ${text || "(photo only)"}${images.length ? " [photo attached]" : ""}`,
        });
        triage = { ...triage, ...JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)) };
        done({ ...tri, why: `${tri.why} Result: ${triage.category}, ${triage.urgency}${triage.hazard ? ", HAZARD" : ""}.` }, t, r.usage);
      } catch (e) {
        put({ ...tri, status: "error", latencyMs: Math.round(performance.now() - t), why: `Triage failed (${(e as Error).message.slice(0, 60)}); keyword safety rules still apply.` });
      }
      const hazard = triage.hazard || HAZARD.test(text);

      if (hazard && !approved) {
        put({ id: "safety", task: "Safety stop", model: "rules + triage", provider: "router", why: "Hazard detected. No DIY plan. Escalate to landlord or emergency services.", status: "awaiting_approval" });
        say("s", `**Stop. This looks hazardous (${triage.category}).**\n\n- If you smell gas or see sparks or smoke: leave now, then call 911 or your gas utility from outside.\n- Do not attempt a DIY fix.\n\nI can draft an urgent repair request to your landlord. Approve below to generate it.`);
        writer.write({ type: "data-approval", id: "approval", data: { id: "approval", action: "notify landlord", reason: "Draft an urgent repair request to your landlord. Nothing is sent automatically.", prompt: text } });
        writer.write({ type: "finish" });
        return;
      }

      // 2. Vision
      let observed = "";
      if (images.length && !approved) {
        const vis: TraceStep = { id: "vision", task: "Inspect the photo", model: "gpt-5", provider: "neon-gateway", why: "Photo attached: strong vision model reads fixture, damage, likely failed part.", status: "running" };
        put(vis);
        t = performance.now();
        try {
          const r = await generateText({
            model: gateway.chat("gpt-5"),
            providerOptions: { "neon-gateway": { reasoningEffort: "low" } },
            messages: [{ role: "user", content: [{ type: "text", text: "Describe the home-repair issue in this photo in 3 short bullets: fixture type, visible problem, likely failed part. No advice." }, ...images.map((url) => ({ type: "image" as const, image: url }))] }],
          });
          observed = r.text;
          done(vis, t, r.usage);
        } catch (e) {
          put({ ...vis, status: "error", latencyMs: Math.round(performance.now() - t), why: `Vision failed: ${(e as Error).message.slice(0, 80)}` });
        }
      } else if (!approved) {
        put({ id: "vision", task: "Inspect the photo", model: "gpt-5", provider: "neon-gateway", why: "No photo attached.", status: "skipped" });
      }

      // 3. Plan
      if (approved) put({ id: "safety", task: "Safety stop", model: "you", provider: "human", why: "Approved: drafting landlord request only. Nothing is sent.", status: "done" });
      const plan: TraceStep = approved
        ? { id: "plan", task: "Draft landlord request", model: "claude-sonnet-5-5", provider: "anthropic", why: "Approved: write a clear, urgent repair request.", status: "running" }
        : { id: "plan", task: "Write the repair plan", model: "claude-sonnet-5-5", provider: "anthropic", why: "Safety-aware step-by-step planning needs the strongest reasoner.", status: "running" };
      put(plan);
      t = performance.now();
      const result = streamText({
        model: anthropic("claude-sonnet-5-5"),
        system: approved
          ? "Draft a short, firm, polite urgent repair request from a renter to a landlord: issue, safety risk, request for a licensed pro within 24h, availability placeholder. Under 150 words."
          : "You are FixIt, a renter repair assistant. Give: 1) Likely cause (1 line). 2) Tools/parts. 3) Numbered steps (max 7) with safety notes. 4) 'Call your landlord if' line. Mention lease limits where relevant. Concise markdown.",
        prompt: `Report: ${text || "(photo only)"}\nTriage: ${JSON.stringify(triage)}${observed ? `\nPhoto analysis:\n${observed}` : ""}`,
      });
      writer.merge(result.toUIMessageStream({ sendStart: false, sendFinish: false }));
      let planText = "";
      try {
        await result.consumeStream();
        planText = await result.text;
        done(plan, t, await result.totalUsage);
      } catch {
        put({ ...plan, status: "error", latencyMs: Math.round(performance.now() - t) });
      }

      // 4. Cross-check
      if (planText && !approved) {
        const cc: TraceStep = { id: "check", task: "Cross-check safety", model: "gpt-5-mini", provider: "neon-gateway", why: "Different model family audits the plan for unsafe or lease-violating steps.", status: "running" };
        put(cc);
        t = performance.now();
        try {
          const r = await generateText({
            model: gateway.chat("gpt-5-mini"),
            providerOptions: { "neon-gateway": { reasoningEffort: "minimal" } },
            prompt: `Audit this renter DIY repair plan. Reply ONE line starting with "PASS:" or "FLAG:" plus the reason.\nPlan:\n${planText}`,
          });
          const verdict = r.text.trim().split("\n")[0];
          done({ ...cc, why: `${cc.why} ${verdict.slice(0, 140)}` }, t, r.usage);
          say("cc", `\n\n> Cross-check (gpt-5-mini): ${verdict}`);
        } catch {
          put({ ...cc, status: "error", latencyMs: Math.round(performance.now() - t) });
        }
      }
      writer.write({ type: "finish" });
    },
    onError: (e) => (e instanceof Error ? e.message : "FixIt failed"),
  });
  return createUIMessageStreamResponse({ stream });
}
