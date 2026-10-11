import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/** USD per token, from the Neon AI Gateway /v1/models listing (Oct 2026). */
const PRICING: Record<string, [number, number]> = {
  "gemini-3-1-flash-lite": [0.00000025, 0.0000015],
  "gemini-3-flash": [0.0000005, 0.000003],
  "gpt-5-4-mini": [0.00000075, 0.0000045],
  "claude-sonnet-5-5": [0.000002, 0.00001],
  "claude-sonnet-5": [0.000002, 0.00001],
};

export function estimateCost(model: string, input: number, output: number) {
  const [i, o] = PRICING[model] ?? [0, 0];
  return input * i + output * o;
}

export type Route = {
  model: string;
  provider: "neon-gateway" | "anthropic";
  task: string;
  why: string;
};

export type RouteInput = { text: string; hasImage: boolean; hasAudio: boolean };

const REASONING = /\b(code|debug|refactor|prove|plan|architect|analy[sz]e|compare|step[- ]by[- ]step|why)\b/i;
const RISKY = /\b(send|email|delete|drop|pay|purchase|transfer|deploy|post|publish)\b/i;

export function needsApproval(text: string): { action: string; reason: string } | null {
  const m = text.match(RISKY);
  if (!m) return null;
  return {
    action: m[1].toLowerCase(),
    reason: `The request asks to "${m[1].toLowerCase()}", an external side effect. A human signs off before any model acts on it.`,
  };
}

/** Stub router: deterministic rules, cheapest capable model first. Swap for a learned router later. */
export function route({ text, hasImage, hasAudio }: RouteInput): Route {
  const anthropic = !!process.env.ANTHROPIC_API_KEY;
  if (hasAudio)
    return { model: "gemini-3-flash", provider: "neon-gateway", task: "Understand audio", why: "Audio attached: needs a native audio-input model. Gemini Flash is the cheapest one on the gateway." };
  if (hasImage)
    return { model: "gpt-5-4-mini", provider: "neon-gateway", task: "Describe image", why: "Image attached: a small vision model is enough and keeps cost low." };
  if (REASONING.test(text) || text.length > 600)
    return anthropic
      ? { model: "claude-sonnet-5-5", provider: "anthropic", task: "Reason", why: "Reasoning or code intent detected: route to the strongest mid-tier reasoner." }
      : { model: "claude-sonnet-5", provider: "neon-gateway", task: "Reason", why: "Reasoning intent detected; Anthropic key absent, so use Claude via the gateway." };
  return { model: "gemini-3-1-flash-lite", provider: "neon-gateway", task: "Answer", why: "Short general prompt: fastest, cheapest model wins." };
}

export function modelFor(r: Route): LanguageModel {
  if (r.provider === "anthropic") return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(r.model);
  const gateway = createOpenAI({
    baseURL: `${(process.env.NEON_AI_GATEWAY_BASE_URL ?? "").replace(/\/$/, "")}/v1`,
    apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
    name: "neon-gateway",
    // Gemini upstream rejects OpenAI's stream_options; strip it for those models.
    fetch: async (url, init) => {
      if (r.model.startsWith("gemini") && typeof init?.body === "string") {
        const body = JSON.parse(init.body);
        delete body.stream_options;
        // Gateway expects audio as audio_url data URLs, not OpenAI input_audio.
        for (const m of body.messages ?? [])
          if (Array.isArray(m.content))
            m.content = m.content.map((c: { type: string; input_audio?: { data: string; format: string } }) =>
              c.type === "input_audio" && c.input_audio
                ? { type: "audio_url", audio_url: { url: `data:audio/${c.input_audio.format};base64,${c.input_audio.data}` } }
                : c,
            );
        init = { ...init, body: JSON.stringify(body) };
      }
      return fetch(url, init);
    },
  });
  return gateway.chat(r.model);
}
