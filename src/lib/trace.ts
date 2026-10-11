import type { UIMessage } from "ai";

export type StepStatus = "running" | "done" | "error" | "awaiting_approval" | "skipped";

export type TraceStep = {
  id: string;
  task: string;
  model: string;
  provider: "router" | "neon-gateway" | "anthropic" | "human" | "typesafe";
  why: string;
  latencyMs?: number;
  costUsd?: number;
  tokens?: { input: number; output: number };
  status: StepStatus;
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
  outbound?: { to: string; subject: string; body: string; tool: string; mode: "swytchcode-dry-run" | "export-fallback"; note: string; idempotencyKey: string };
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
};

export type MMMessage = UIMessage<
  never,
  { trace: TraceStep; approval: ApprovalRequest; job: { jobId: string; jobToken?: string }; chips: { options: string[] }; ctx: FixitCtx; email: { subject: string } }
>;
