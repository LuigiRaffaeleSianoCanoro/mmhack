import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { getAssistant } from "@/lib/assistants";
import { estimateCost, modelFor, needsApproval, route } from "@/lib/router";
import type { MMMessage, TraceStep } from "@/lib/trace";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, approved, assistant: slug }: { messages: MMMessage[]; approved?: boolean; assistant?: string } = await req.json();
  const assistant = getAssistant(slug ?? "router") ?? getAssistant("router")!;
  const last = messages[messages.length - 1];
  const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
  const files = last.parts.filter((p) => p.type === "file");
  const hasImage = files.some((f) => f.type === "file" && f.mediaType.startsWith("image/"));
  const hasAudio = files.some((f) => f.type === "file" && f.mediaType.startsWith("audio/"));

  const stream = createUIMessageStream<MMMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      const t0 = performance.now();
      const r = route({ text, hasImage, hasAudio, prefer: assistant.prefer });
      const classify: TraceStep = {
        id: "classify",
        task: "Classify request",
        model: "rules-v0",
        provider: "router",
        why: `Signals: ${[hasImage && "image", hasAudio && "audio", text.length > 600 && "long", "text"].filter(Boolean).join(", ")}. Picked ${r.model}.`,
        latencyMs: Math.round(performance.now() - t0),
        costUsd: 0,
        status: "done",
      };
      writer.write({ type: "data-trace", id: classify.id, data: classify });

      const gate = needsApproval(text);
      if (gate && !approved) {
        writer.write({
          type: "data-trace",
          id: "approval",
          data: { id: "approval", task: "Human approval", model: "you", provider: "human", why: gate.reason, status: "awaiting_approval" },
        });
        writer.write({ type: "data-approval", id: "approval", data: { id: "approval", ...gate, prompt: text } });
        writer.write({ type: "finish" });
        return;
      }
      if (gate && approved) {
        writer.write({
          type: "data-trace",
          id: "approval",
          data: { id: "approval", task: "Human approval", model: "you", provider: "human", why: "Approved by a human.", status: "done" },
        });
      }

      const step: TraceStep = { id: "generate", task: r.task, model: r.model, provider: r.provider, why: r.why, status: "running" };
      writer.write({ type: "data-trace", id: step.id, data: step });
      const t1 = performance.now();
      let failed = false;
      const result = streamText({
        model: modelFor(r),
        system: `${assistant.system} You are "${assistant.title}" inside FixIt. Prefer short answers with clear structure.`,
        messages: await convertToModelMessages(messages),
        onError: ({ error }) => {
          failed = true;
          console.error("[mmhack] model error", r.model, error);
          writer.write({ type: "data-trace", id: step.id, data: { ...step, status: "error", latencyMs: Math.round(performance.now() - t1) } });
        },
      });
      // Hold the finish chunk so the final trace update lands in the same assistant message.
      writer.merge(result.toUIMessageStream({ sendStart: false, sendFinish: false }));
      await result.consumeStream();
      if (!failed) {
        const [totalUsage, out] = await Promise.all([result.totalUsage, result.text]);
        // Some upstreams omit usage when streaming; fall back to a ~4 chars/token estimate.
        const input = totalUsage.inputTokens ?? Math.ceil(JSON.stringify(messages).length / 4);
        const output = totalUsage.outputTokens ?? Math.ceil(out.length / 4);
        writer.write({
          type: "data-trace",
          id: step.id,
          data: { ...step, status: "done", latencyMs: Math.round(performance.now() - t1), tokens: { input, output }, costUsd: estimateCost(r.model, input, output) },
        });
      }
      writer.write({ type: "finish" });
    },
    onError: (e) => (e instanceof Error ? e.message : "Model call failed"),
  });
  return createUIMessageStreamResponse({ stream });
}
