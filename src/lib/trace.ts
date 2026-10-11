import type { UIMessage } from "ai";

export type StepStatus = "running" | "done" | "error" | "awaiting_approval" | "skipped";

export type TraceStep = {
  id: string;
  task: string;
  model: string;
  provider: "router" | "neon-gateway" | "anthropic" | "human";
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
};

export type MMMessage = UIMessage<
  never,
  { trace: TraceStep; approval: ApprovalRequest }
>;
