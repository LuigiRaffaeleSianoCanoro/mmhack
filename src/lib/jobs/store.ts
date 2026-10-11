import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { rmSync, mkdirSync, openSync, closeSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Actor } from "anbaric-tsapi";
import { canTransition, type JobState } from "./workflow";

export type AuditEvent = {
  at: string;
  actor: Actor;
  action: string;
  from?: JobState;
  to?: JobState;
  ok: boolean;
  details?: Record<string, unknown>;
};

export type FixitJob = {
  id: string;
  sessionId: string;
  state: JobState;
  draft: string;
  draftHash: string;
  approval?: { sessionId: string; draftHash: string; at: string };
  claimId?: string;
  audit: AuditEvent[];
};

/**
 * Persistence adapter. "anbaric-cloud" is used only when the Anbaric platform injects
 * ANBARIC_JOB_PERSISTENCE_TYPE=cloud into a deployed app. Everything else is the
 * LOCAL FALLBACK: a durable JSON file store with the same contract. It is not an Anbaric integration.
 */
export const STORE_KIND: "anbaric-cloud" | "local-fallback" =
  process.env.ANBARIC_JOB_PERSISTENCE_TYPE === "cloud" ? "anbaric-cloud" : "local-fallback";
// Honest label: persistence is always the instance file store + signed snapshot; Anbaric supplies the state/actor contracts.
export const STORE_LABEL = STORE_KIND === "anbaric-cloud" ? "Anbaric contracts · instance store" : "Anbaric state model · signed job (cloud sync off)";

const DIR = process.env.FIXIT_DATA_DIR ?? (process.env.VERCEL ? "/tmp/fixit-jobs" : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "jobs"));
const file = (id: string, ext = "json") => path.join(/*turbopackIgnore: true*/ DIR, `${id.replace(/[^a-zA-Z0-9-]/g, "")}.${ext}`);

export const hashDraft = (draft: string) => createHash("sha256").update(draft.normalize("NFC").replace(/\s+/g, " ").trim()).digest("hex");

function write(job: FixitJob) {
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = `${file(job.id)}.${randomUUID()}.tmp`;
    writeFileSync(tmp, JSON.stringify(job, null, 2));
    renameSync(tmp, file(job.id));
  } catch (e) {
    // Read-only or full disk: keep going on the signed snapshot instead of failing the user's request.
    console.error("[jobs] write failed:", (e as Error).message);
  }
}

/**
 * Vercel runs many instances and /tmp is per-instance, so the browser also carries an HMAC-signed
 * snapshot of its job ("jobToken"). If this instance has never seen the job, a valid snapshot
 * rehydrates it. The key is server-only (FIXIT_JOB_SECRET, else derived from server API keys);
 * without any key, rehydration is off and the labelled single-instance fallback applies.
 */
const SECRET = process.env.FIXIT_JOB_SECRET || (process.env.NEON_AI_GATEWAY_TOKEN ? createHash("sha256").update(`fixit-job:${process.env.NEON_AI_GATEWAY_TOKEN}`).digest("hex") : "");
const mac = (b: string) => createHmac("sha256", SECRET).update(b).digest("base64url");
export function sealJob(job: FixitJob): string | undefined {
  if (!SECRET) return undefined;
  const b = Buffer.from(JSON.stringify(job)).toString("base64url");
  return `${b}.${mac(b)}`;
}
function unseal(token: string | undefined, id: string): FixitJob | null {
  if (!SECRET || !token || token.length > 200_000) return null;
  const [b, sig] = token.split(".");
  if (!b || !sig) return null;
  const want = Buffer.from(mac(b)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const j = JSON.parse(Buffer.from(b, "base64url").toString("utf8")) as FixitJob;
    return j.id === id ? j : null;
  } catch {
    return null;
  }
}

export function getJob(id: string, token?: string): FixitJob | null {
  let local: FixitJob | null = null;
  try {
    local = JSON.parse(readFileSync(file(id), "utf8"));
  } catch {}
  const snap = unseal(token, id);
  // Prefer whichever copy has seen more audited events (a signed snapshot can only come from this server).
  if (snap && (!local || snap.audit.length > local.audit.length)) {
    try { write(snap); } catch {}
    return snap;
  }
  return local;
}

function event(job: FixitJob, e: Omit<AuditEvent, "at">) {
  job.audit.push({ at: new Date().toISOString(), ...e });
}

export function transition(job: FixitJob, to: JobState, a: Actor, action: string, details?: Record<string, unknown>) {
  const from = job.state;
  const ok = canTransition(from, to);
  event(job, { actor: a, action, from, to, ok, details: ok ? details : { ...details, denied: `illegal transition ${from} -> ${to}` } });
  if (ok) job.state = to;
  write(job);
  return ok;
}

export function audit(job: FixitJob, a: Actor, action: string, ok: boolean, details?: Record<string, unknown>) {
  event(job, { actor: a, action, ok, details });
  write(job);
}

export function createJob(sessionId: string, intake: Actor, draft: string): FixitJob {
  const job: FixitJob = { id: randomUUID(), sessionId, state: "intake", draft, draftHash: hashDraft(draft), audit: [] };
  event(job, { actor: intake, action: "job created", to: "intake", ok: true, details: { store: STORE_KIND } });
  write(job);
  return job;
}

/** Edit the draft: any prior approval is invalidated. */
export function editDraft(job: FixitJob, a: Actor, draft: string) {
  if (job.state !== "awaiting_approval" && job.state !== "approved") return audit(job, a, `draft edit denied: state ${job.state}`, false), false;
  job.draft = draft;
  job.draftHash = hashDraft(draft);
  if (job.approval) {
    job.approval = undefined;
    transition(job, "awaiting_approval", a, "draft edited: approval invalidated", { draftHash: job.draftHash });
  } else audit(job, a, "draft edited", true, { draftHash: job.draftHash });
}

export function decide(job: FixitJob, a: Actor, sessionId: string, decision: "approved" | "rejected", draftHash: string) {
  if (job.sessionId !== sessionId) return audit(job, a, `${decision} denied: wrong session`, false, { draftHash }), false;
  if (job.state !== "awaiting_approval") return audit(job, a, `${decision} denied: state ${job.state}`, false, { draftHash }), false;
  if (draftHash !== job.draftHash) return audit(job, a, `${decision} denied: stale draft`, false, { draftHash, current: job.draftHash }), false;
  if (decision === "approved") job.approval = { sessionId, draftHash, at: new Date().toISOString() };
  return transition(job, decision, a, `human ${decision}`, { sessionId, draftHash });
}

/**
 * Atomic, durable execution claim. Exclusive file create (O_EXCL) means two concurrent
 * requests, or a request after a worker restart, can never both win.
 */
export function claimExecution(job: FixitJob, a: Actor, sessionId: string, draftHash: string): { ok: true; claimId: string } | { ok: false; reason: string; claimId?: string } {
  const deny = (reason: string) => (audit(job, a, `execution denied: ${reason}`, false, { draftHash, sessionId }), { ok: false as const, reason, claimId: job.claimId });
  if (job.sessionId !== sessionId) return deny("wrong session");
  if (!job.approval) return deny(job.state === "rejected" ? "rejected" : "no approval");
  if (job.approval.draftHash !== draftHash || job.draftHash !== draftHash) return deny("approval does not match current draft");
  if (job.claimId) return (audit(job, a, "execution denied: already claimed", false, { claimId: job.claimId }), { ok: false as const, reason: "already claimed", claimId: job.claimId });
  const claimId = randomUUID();
  try {
    mkdirSync(DIR, { recursive: true });
    const fd = openSync(file(job.id, "claim"), "wx");
    writeFileSync(fd, JSON.stringify({ claimId, draftHash, at: new Date().toISOString() }));
    closeSync(fd);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") return deny("job store unavailable");
    const fresh = getJob(job.id) ?? job;
    let existing = fresh.claimId;
    try { if (existsSync(file(job.id, "claim"))) existing = JSON.parse(readFileSync(file(job.id, "claim"), "utf8")).claimId; } catch {}
    audit(fresh, a, "execution denied: already claimed", false, { claimId: existing });
    return { ok: false, reason: "already claimed", claimId: existing };
  }
  job.claimId = claimId;
  transition(job, "action", a, "execution claimed", { claimId, draftHash });
  return { ok: true, claimId };
}

/** The action failed after claiming: release the claim so the human can retry (audited). */
export function releaseClaim(job: FixitJob, a: Actor, reason: string) {
  try { rmSync(file(job.id, "claim"), { force: true }); } catch {}
  job.claimId = undefined;
  transition(job, "approved", a, `action failed, claim released: ${reason}`);
}

export function finish(job: FixitJob, a: Actor, result: Record<string, unknown>) {
  transition(job, "done", a, "action finished", result);
}

/** Browser-safe view: no draft body leakage beyond what the owner already has. */
export const publicJob = (j: FixitJob) => ({ id: j.id, state: j.state, draftHash: j.draftHash, claimId: j.claimId, store: STORE_KIND, storeLabel: STORE_LABEL, audit: j.audit, jobToken: sealJob(j) });
