import { createUIMessageStream, createUIMessageStreamResponse, generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { estimateCost } from "@/lib/router";
import { jevEnabled, jevTriage, JEV_MODEL } from "@/lib/jev";
import type { FixitCtx, MMMessage, TraceStep } from "@/lib/trace";

export const maxDuration = 120;

const gateway = createOpenAI({
  baseURL: `${(process.env.NEON_AI_GATEWAY_BASE_URL ?? "").replace(/\/$/, "")}/v1`,
  apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
  name: "neon-gateway",
});
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HAZARD = /\b(gas|spark|sparking|sparks|burning|smoke|shock|exposed wire|carbon monoxide|flood(ing)?|sewage|sagging|chispa|humo|olor a gas|fuga de gas|cortocircuito)\b/i;
const DETAILS = "<!--details-->";

type Triage = FixitCtx["triage"];
type Usage = { inputTokens?: number; outputTokens?: number };
const MINI = { "neon-gateway": { reasoningEffort: "minimal" } };
const json = <T,>(t: string): T => JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));

export async function POST(req: Request) {
  const { messages, approved }: { messages: MMMessage[]; approved?: boolean } = await req.json();
  const last = messages[messages.length - 1];
  const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
  const images = last.parts.flatMap((p) => (p.type === "file" && p.mediaType.startsWith("image/") ? [p.url] : []));
  let ctx: FixitCtx | undefined;
  for (const m of [...messages].reverse()) {
    const c = m.parts.find((p) => p.type === "data-ctx");
    if (c && c.type === "data-ctx") { ctx = c.data; break; }
  }
  const transcript = messages
    .map((m) => `${m.role}: ${m.parts.map((p) => (p.type === "text" ? p.text : p.type === "file" ? "[photo]" : "")).join(" ").split(DETAILS)[0].trim()}`)
    .join("\n")
    .slice(-4000);

  const stream = createUIMessageStream<MMMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      const put = (s: TraceStep) => writer.write({ type: "data-trace", id: s.id, data: s });
      const done = (s: TraceStep, t: number, u: Usage, extra?: Partial<TraceStep>) => {
        const known = u.inputTokens != null && u.outputTokens != null;
        put({ ...s, ...extra, status: "done", latencyMs: Math.round(performance.now() - t), tokens: known ? { input: u.inputTokens!, output: u.outputTokens! } : undefined, costUsd: known ? estimateCost(s.model, u.inputTokens!, u.outputTokens!) : undefined });
      };
      const fail = (s: TraceStep, t: number, e: unknown) => put({ ...s, status: "error", latencyMs: Math.round(performance.now() - t), why: `${s.why} Failed: ${reasonOf(e)}` });
      const say = (id: string, delta: string) => {
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta });
        writer.write({ type: "text-end", id });
      };
      const chips = (options: string[]) => options.length && writer.write({ type: "data-chips", id: "chips", data: { options: options.slice(0, 4) } });
      const save = (c: FixitCtx) => writer.write({ type: "data-ctx", id: "ctx", data: c });
      const finish = () => writer.write({ type: "finish" });
      // Ask gpt-5-mini for a small JSON turn, traced.
      const mini = async <T,>(id: string, task: string, why: string, prompt: string, fallback: T): Promise<T> => {
        const s: TraceStep = { id, task, model: "gpt-5-mini", provider: "neon-gateway", why, status: "running" };
        put(s);
        const t = performance.now();
        try {
          const r = await generateText({ model: gateway.chat("gpt-5-mini"), providerOptions: MINI, prompt });
          const v = json<T>(r.text);
          done(s, t, r.usage);
          return v;
        } catch (e) {
          fail(s, t, e);
          return fallback;
        }
      };
      const safetyStop = (category: string) => {
        put({ id: "safety", task: "Safety stop", model: "rules + triage", provider: "router", why: "Hazard detected. No DIY steps. Escalate to landlord or emergency services.", status: "awaiting_approval" });
        say("s", `**Stop: this looks hazardous (${category}).** If you smell gas or see sparks or smoke, leave now and call 911 or your utility from outside. I can draft an urgent request to your landlord.`);
        writer.write({ type: "data-approval", id: "approval", data: { id: "approval", action: "notify landlord", reason: "Draft an urgent repair request to your landlord. Nothing is sent automatically.", prompt: ctx?.summary || text } });
        finish();
      };

      // Stream one model's text into the UI; throws a sanitized error on failure.
      const runText = async (model: Parameters<typeof streamText>[0]["model"], textId: string, timeoutMs: number, system: string, prompt: string) => {
        let err: unknown;
        const r = streamText({ model, system, prompt, abortSignal: AbortSignal.timeout(timeoutMs), onError: ({ error }) => { err = error; } });
        let out = "";
        let started = false;
        for await (const part of r.fullStream) {
          if (part.type === "text-delta") {
            if (!started) { writer.write({ type: "text-start", id: textId }); started = true; }
            out += part.text;
            writer.write({ type: "text-delta", id: textId, delta: part.text });
          } else if (part.type === "error") err = part.error;
        }
        if (started) writer.write({ type: "text-end", id: textId });
        if (err || !out) throw err ?? new Error("empty response");
        return { out, usage: await Promise.resolve(r.totalUsage).catch((): Usage => ({})) };
      };
      // Sonnet first, gpt-5 on the gateway if Claude fails or times out.
      const sonnet = async (task: string, why: string, system: string, prompt: string) => {
        const s: TraceStep = { id: "plan", task, model: "claude-sonnet-5-5", provider: "anthropic", why, status: "running" };
        put(s);
        let t = performance.now();
        try {
          const r = await runText(anthropic("claude-sonnet-5-5"), "plan", 45_000, system, prompt);
          done(s, t, r.usage);
          return r.out;
        } catch (e) {
          const reason = reasonOf(e);
          console.error("[fixit] claude failed:", reason, (e as { responseBody?: string })?.responseBody?.slice(0, 500));
          put({ ...s, status: "error", latencyMs: Math.round(performance.now() - t), why: `Claude failed: ${reason}` });
          const fb: TraceStep = { ...s, id: "plan-fallback", model: "gpt-5", provider: "neon-gateway", why: `fallback: gpt-5, reason: ${reason}`, status: "running" };
          put(fb);
          t = performance.now();
          try {
            const r = await runText(gateway.chat("gpt-5"), "plan-fb", 90_000, system, prompt);
            done(fb, t, r.usage);
            return r.out;
          } catch (e2) {
            console.error("[fixit] fallback failed:", reasonOf(e2));
            put({ ...fb, status: "error", latencyMs: Math.round(performance.now() - t), why: `fallback: gpt-5 also failed: ${reasonOf(e2)}` });
            return "";
          }
        }
      };
      const lang = ctx?.lang ?? "the user's language";

      // Approved: draft landlord request.
      if (approved) {
        put({ id: "safety", task: "Approval", model: "you", provider: "human", why: "Approved: drafting landlord request only. Nothing is sent.", status: "done" });
        await sonnet("Draft landlord request", "Approved: write a clear, urgent repair request.",
          `Draft a short, firm, polite repair request from a renter to a landlord in ${lang}: issue, any safety risk, ask for a licensed pro soon, availability placeholder. Under 120 words.`,
          `Issue: ${ctx?.summary ?? text}\nConversation:\n${transcript}`);
        finish();
        return;
      }

      // Any turn: obvious hazard words stop immediately.
      if (HAZARD.test(text)) return safetyStop(/gas/i.test(text) ? "gas" : /spark|wire|shock|chispa|cortocircuito/i.test(text) ? "electrical" : ctx?.triage.category ?? "hazard");

      // Turn 1: triage + vision in parallel, then a one-line confirmation.
      if (!ctx) {
        const tri: TraceStep = { id: "triage", task: "Triage the problem", model: "gpt-5-mini", provider: "neon-gateway", why: "Short structured classification: smallest reliable model.", status: "running" };
        const vis: TraceStep = { id: "vision", task: "Inspect the photo", model: "gpt-5", provider: "neon-gateway", why: "Photo attached: strong vision model reads fixture, damage, likely failed part.", status: "running" };
        const t0 = performance.now();
        const visionP = images.length
          ? (put(vis), generateText({ model: gateway.chat("gpt-5"), providerOptions: { "neon-gateway": { reasoningEffort: "low" } }, messages: [{ role: "user", content: [{ type: "text", text: "Describe the home-repair issue in this photo in 3 short bullets: fixture type, visible problem, likely failed part. No advice." }, ...images.map((url) => ({ type: "image" as const, image: url }))] }] }))
          : null;
        visionP?.catch(() => {});
        let triage: Triage & { lang?: string } = { category: "general", urgency: "medium", hazard: false, summary: text };
        // Optional raw Jev (TypeSafe) first when flagged on; any failure falls back to gpt-5-mini.
        let jevDone = false;
        if (jevEnabled()) {
          const js: TraceStep = { id: "triage", task: "Triage the problem", model: JEV_MODEL, provider: "typesafe", why: "Jev flag on: TypeSafe SystemOne classifies with calibrated probabilities.", status: "running" };
          put(js);
          const tj = performance.now();
          try {
            const j = await jevTriage(text, images.length > 0);
            triage = { ...triage, ...j.triage, lang: "the user's language" };
            jevDone = true;
            put({ ...js, model: j.model, status: "done", latencyMs: j.latencyMs, tokens: j.usage, costUsd: undefined,
              why: `Raw Jev (${j.model}), measured ${j.latencyMs} ms. Result: ${triage.category}, ${triage.urgency}${triage.hazard ? ", HAZARD" : ""}; confidence ${j.confidence.toFixed(2)}, P(hazard) ${j.hazardP.toFixed(2)}. Cost unknown.` });
          } catch (e) {
            put({ ...js, status: "error", latencyMs: Math.round(performance.now() - tj), why: `Jev unusable (${reasonOf(e)}); falling back to gpt-5-mini.` });
          }
        }
        if (!jevDone) try {
          put(tri);
          const r = await generateText({
            model: gateway.chat("gpt-5-mini"),
            providerOptions: MINI,
            prompt: `Classify this renter home-repair report. Reply ONLY JSON {"category":"plumbing|electrical|gas|appliance|hvac|pest|structural|general","urgency":"low|medium|high|emergency","hazard":boolean (true for gas, electrical, fire, flooding, CO),"summary":"<12 words","lang":"language name of the user's text, default English"}.\nReport: ${text || "(photo only)"}${images.length ? " [photo attached]" : ""}`,
          });
          triage = { ...triage, ...json<Triage & { lang?: string }>(r.text) };
          done(tri, t0, r.usage, { why: `${tri.why} Result: ${triage.category}, ${triage.urgency}${triage.hazard ? ", HAZARD" : ""}.` });
        } catch (e) {
          fail(tri, t0, e);
        }
        if (triage.hazard) return safetyStop(triage.category);
        let observed = "";
        if (visionP) {
          try {
            const r = await visionP;
            observed = r.text;
            done(vis, t0, r.usage);
            // Post-vision hazard stop: the photo itself can reveal a hazard the text did not mention.
            if (HAZARD.test(observed)) return safetyStop(/gas/i.test(observed) ? "gas" : /spark|wire|shock/i.test(observed) ? "electrical" : triage.category || "hazard");
          } catch (e) {
            fail(vis, t0, e);
          }
        }
        const L = triage.lang || "English";
        const c = await mini<{ message: string; chips: string[] }>("confirm", "Confirm what I see", "One-sentence confirmation: cheap fast model.",
          `You are FixIt. In ${L}, write ONE short sentence confirming the problem, ending with a question like "I see a kitchen faucet dripping from the spout. Right?". Also give 3 quick-reply chips in ${L} meaning exactly: "Yes", "Not quite", "Something else is broken". Reply ONLY JSON {"message":"...","chips":["...","...","..."]}.\nUser: ${text || "(photo only)"}\nPhoto analysis: ${observed || "none"}\nTriage: ${triage.summary}`,
          { message: `I think the issue is: ${triage.summary}. Right?`, chips: ["Yes", "Not quite", "Something else is broken"] });
        say("c", c.message);
        chips(c.chips);
        save({ stage: "confirm", lang: L, summary: triage.summary, observed, triage, pending: [] });
        finish();
        return;
      }

      // Turn 2: user answered the confirmation.
      if (ctx.stage === "confirm") {
        const r = await mini<{ confirmed: boolean; message: string; chips: string[]; summary: string; questions: { q: string; chips: string[] }[] }>(
          "understand", "Understand the reply", "Short reasoning over a quick reply: cheap fast model.",
          `You are FixIt, a renter repair assistant. Language: ${ctx.lang}. Current understanding: "${ctx.summary}". Photo analysis: ${ctx.observed || "none"}.\nConversation:\n${transcript}\n\nDecide if the user confirmed the problem. If yes: confirmed=true, summary=refined issue, and give 1-2 short clarifying questions that change the fix (e.g. "Single handle or two handles?", "Do you rent?") each with 2-4 short chip answers. If they said "not quite": reinterpret in ONE short sentence ending with "Right?" and chips meaning Yes / Not quite / Something else is broken. If something else is broken: ask in one sentence which element (chips: 3-4 likely elements). All text in ${ctx.lang}, max 1-2 sentences. Reply ONLY JSON {"confirmed":bool,"message":"(only when not confirmed)","chips":[],"summary":"...","questions":[{"q":"...","chips":["..."]}]}`,
          { confirmed: true, message: "", chips: [], summary: ctx.summary, questions: [{ q: "Do you rent?", chips: ["Yes", "No"] }] });
        if (!r.confirmed) {
          say("m", r.message);
          chips(r.chips ?? []);
          save({ ...ctx, summary: r.summary || ctx.summary });
          finish();
          return;
        }
        const [first, ...rest] = (r.questions ?? []).slice(0, 2);
        if (first) {
          say("q", first.q);
          chips(first.chips ?? []);
          save({ ...ctx, stage: "clarify", summary: r.summary || ctx.summary, pending: rest });
          finish();
          return;
        }
        ctx = { ...ctx, summary: r.summary || ctx.summary };
      } else if (ctx.stage === "clarify" && ctx.pending.length) {
        const [next, ...rest] = ctx.pending;
        put({ id: "ask", task: "Next clarifying question", model: "none (queued)", provider: "router", why: "Question was planned in the previous turn; no model call needed.", status: "done", latencyMs: 0 });
        say("q", next.q);
        chips(next.chips ?? []);
        save({ ...ctx, pending: rest });
        finish();
        return;
      } else if (ctx.stage === "done") {
        const r = await mini<{ message: string }>("followup", "Follow-up answer", "Short follow-up: cheap fast model.",
          `You are FixIt. In ${ctx.lang}, answer the user's last message in 1-3 short sentences, safety first. Issue: ${ctx.summary}.\nConversation:\n${transcript}\nReply ONLY JSON {"message":"..."}`, { message: "Sorry, I could not answer that. Try rephrasing?" });
        say("f", r.message);
        finish();
        return;
      }

      // Turn 3: concise plan (Sonnet, gpt-5 fallback), then cross-check and landlord option.
      const planText = await sonnet("Write the repair plan", "Safety-aware step-by-step planning needs the strongest reasoner.",
        `You are FixIt, a renter repair assistant. Write in ${ctx.lang}. Format exactly:\n1 short sentence with the likely cause.\n**Tools:** comma list.\nUp to 5 numbered steps, each under 15 words.\nOne line: when to call the landlord.\nThen a line containing only ${DETAILS} followed by a longer detailed version (safety notes, lease limits, troubleshooting).`,
        `Issue: ${ctx.summary}\nPhoto analysis: ${ctx.observed || "none"}\nTriage: ${JSON.stringify(ctx.triage)}\nConversation:\n${transcript}`);
      if (planText) {
        await mini<{ v: string }>("check", "Cross-check safety", "Different model family audits the plan for unsafe or lease-violating steps.",
          `Audit this renter DIY repair plan. Reply ONLY JSON {"v":"PASS: reason" or "FLAG: reason"} (one line).\nPlan:\n${planText}`, { v: "" });
      }
      writer.write({ type: "data-approval", id: "approval", data: { id: "approval", action: "notify landlord", reason: "Want me to draft a repair request to your landlord instead? Nothing is sent automatically.", prompt: ctx.summary } });
      save({ ...ctx, stage: "done", pending: [] });
      finish();
    },
    onError: (e) => (e instanceof Error ? e.message : "FixIt failed"),
  });
  return createUIMessageStreamResponse({ stream });
}

function reasonOf(e: unknown) {
  const x = e as { statusCode?: number; status?: number; message?: string; name?: string; responseBody?: string };
  let msg = x?.message ?? String(e);
  try { const j = JSON.parse(x?.responseBody ?? ""); msg = j?.error?.message ?? msg; } catch {}
  if (x?.name === "TimeoutError" || x?.name === "AbortError") msg = "timed out";
  const st = x?.statusCode ?? x?.status;
  return `${st ? `${st} ` : ""}${msg}`.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[key]").slice(0, 120);
}
