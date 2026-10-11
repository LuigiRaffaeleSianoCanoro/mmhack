import { State, Transition, type Actor } from "anbaric-tsapi";
import type { Job as AnbaricJob } from "anbaric-tsapi";

/** FixIt job lifecycle modelled with Anbaric's State/Transition contracts. */
export const JOB_STATES = ["intake", "triage", "diagnosis", "awaiting_approval", "approved", "rejected", "action", "done"] as const;
export type JobState = (typeof JOB_STATES)[number];

const prop = async (j: AnbaricJob, k: string) => await j.properties.get(k);
export const WORKFLOW: State[] = [
  new State("intake", [], [new Transition("triage")]),
  new State("triage", [], [new Transition("diagnosis", async (j) => (await prop(j, "triage")) != null)]),
  new State("diagnosis", [], [new Transition("awaiting_approval", async (j) => (await prop(j, "draftHash")) != null)]),
  new State("awaiting_approval", [], [
    new Transition("approved", async (j) => (await prop(j, "decision")) === "approved"),
    new Transition("rejected", async (j) => (await prop(j, "decision")) === "rejected"),
  ]),
  new State("approved", [], [new Transition("action", async (j) => (await prop(j, "claimId")) != null), new Transition("awaiting_approval", async (j) => (await prop(j, "decision")) == null)]),
  new State("rejected", [], [], true),
  new State("action", [], [new Transition("done", async (j) => (await prop(j, "result")) != null), new Transition("approved", async (j) => (await prop(j, "claimId")) == null)]),
  new State("done", [], [], true),
];

export function canTransition(from: JobState, to: JobState) {
  return WORKFLOW.find((s) => s.id === from)?.transitions.some((t) => t.to === to) ?? false;
}

export const actor = {
  agent: (model: string): Actor => ({ type: "AGENT", id: model, roles: ["fixit-pipeline"] }),
  code: (id: string): Actor => ({ type: "CODE", id, roles: ["rules"] }),
  human: (sessionId: string): Actor => ({ type: "HUMAN", id: sessionId, roles: ["renter"] }),
  system: (): Actor => ({ type: "SYSTEM", id: "fixit", roles: ["workflow"] }),
};
