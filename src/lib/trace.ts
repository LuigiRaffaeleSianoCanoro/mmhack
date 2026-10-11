import type { UIMessage } from "ai";
import type { IllustrationRequest } from "./illustration";

export type StepStatus = "running" | "done" | "error" | "awaiting_approval" | "skipped";

export type TraceStep = {
  id: string;
  task: string;
  model: string;
  provider: "router" | "neon-gateway" | "human" | "typesafe";
  why: string;
  latencyMs?: number;
  costUsd?: number;
  tokens?: { input: number; output: number };
  status: StepStatus;
  /** Cost cannot be measured (e.g. image generation); shown as "unknown", never $0 or summed. */
  costUnknown?: boolean;
  /** Plain-language result for the user (e.g. what the photo shows, the safety verdict). */
  note?: string;
};

export type ApprovalRequest = {
  id: string;
  action: string;
  reason: string;
  prompt: string;
  /** AWS-54: audited job bound to the server session + canonical draft hash. */
  jobId?: string;
  draftHash?: string;
  store?: "anbaric-cloud" | "local-fallback";
  storeLabel?: string;
  /** AWS-55: side-effect-free preview of the one governed outbound action. */
  outbound?: { to: string; from: string; subject: string; body: string; tool: string; mode: "send" | "export"; note: string; idempotencyKey: string };
  /** Server-signed job snapshot so the audit survives serverless instance changes. */
  jobToken?: string;
};

export type FixitCtx = {
  stage: "confirm" | "clarify" | "done";
  lang: string;
  summary: string;
  observed: string;
  triage: { category: string; urgency: string; hazard: boolean; summary: string };
  pending: { q: string; chips: string[] }[];
  /** AWS-66: sticky hazard flag for the case; never downgraded once set. */
  hazard?: boolean;
  /** Tenure for this case: wizard answer wins, else the profile. Owners never get a landlord card. */
  tenure?: "rent" | "own";
  approval?: "pending" | "approved";
  delivery?: "draft" | "sent" | "failed" | "unknown";
  draft?: { subject: string; body: string; to?: string };
};

/** AWS-67/68: inline actions answering follow-ups (sign in, connect Gmail, copy, mailto). */
export type CtaAction = "signin" | "gmail" | "copy" | "mailto";
export type Cta = { actions: CtaAction[]; subject?: string; body?: string; to?: string };

/** Emitted after an approved landlord request is ready; enables the Base44 Landlord Inbox delivery card (only when Base44 is configured). */
export type DeliveryReady = { id: string; title: string; urgency: string; category: string; summary: string; body?: string };

export type MMMessage = UIMessage<
  { approval?: boolean },
  { trace: TraceStep; approval: ApprovalRequest; job: { jobId: string; jobToken?: string }; chips: { options: string[] }; ctx: FixitCtx; email: { subject: string; body?: string; sendKey?: string; to?: string; sent?: { at: number; to: string; id?: string } }; illustration: IllustrationRequest; delivery: DeliveryReady; cta: Cta; pros: { owner: boolean } }
>;
