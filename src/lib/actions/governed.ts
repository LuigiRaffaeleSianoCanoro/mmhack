import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { getJob, audit, finish, type FixitJob } from "@/lib/jobs/store";
import { actor } from "@/lib/jobs/workflow";

/**
 * AWS-55: one governed outbound action, routed through the Swytchcode kernel (`swytchcode exec`).
 * Allow-list lives in /tooling.json. This module is also the governed-action interface for M3's inbox.
 */
export const ALLOWED_ACTIONS = { "notify-landlord": "resend.emails.send" } as const;
export type ActionName = keyof typeof ALLOWED_ACTIONS;

export type Outbound = { action: ActionName; tool: string; to: string; subject: string; body: string };
export type Preview = Outbound & { mode: "swytchcode-dry-run" | "export-fallback"; note: string; idempotencyKey: string };
export type ExecRecord = { idempotencyKey: string; jobId: string; status: "sent" | "unknown" | "failed" | "not_sent_export"; providerId?: string; detail: string; at: string };

const BIN = process.env.SWYTCHCODE_BIN ?? "swytchcode";
const TIMEOUT_MS = Math.min(30000, Math.max(1000, Number(process.env.SWYTCHCODE_TIMEOUT_MS) || 15000));
const DIR = process.env.FIXIT_DATA_DIR ?? (process.env.VERCEL ? "/tmp/fixit-jobs" : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "jobs"));

export const canonical = (o: Outbound) => JSON.stringify({ action: o.action, tool: o.tool, to: o.to, subject: o.subject, body: o.body });
export const idempotencyKey = (jobId: string, o: Outbound) => createHash("sha256").update(`${jobId}\n${canonical(o)}`).digest("hex").slice(0, 32);

/** Configured = Swytchcode project + provider creds declared via env flag (no secrets in repo). */
const configured = () => process.env.SWYTCHCODE_ENABLED === "1";

export function buildOutbound(report: string, category: string, hazard = true): Outbound {
  // Recipient is pinned server-side (env), never taken from model or user output.
  const to = process.env.LANDLORD_EMAIL || "landlord@example.com";
  const issue = report.replace(/\s+/g, " ").slice(0, 400);
  return {
    action: "notify-landlord",
    tool: ALLOWED_ACTIONS["notify-landlord"],
    to,
    subject: hazard ? `Urgent repair request: possible ${category} hazard` : `Repair request: ${category}`,
    body: hazard
      ? `Hello,\n\nI am reporting an urgent ${category} issue at my unit: "${issue}".\nThis may be a safety hazard. Please send a licensed professional within 24 hours.\n\nThank you.`
      : `Hello,\n\nI am reporting a ${category} issue at my unit: "${issue}".\nCould you arrange a repair at your earliest convenience? I can share photos and availability.\n\nThank you.`,
  };
}

function run(args: string[], input?: string): Promise<{ code: number | null; out: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = execFile(BIN, args, { timeout: TIMEOUT_MS, cwd: process.cwd(), env: process.env }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
      resolve({ code: e ? (typeof e.code === "number" ? e.code : -1) : 0, out: `${stdout}${stderr}`.slice(0, 2000), timedOut: !!e?.killed });
    });
    if (input) child.stdin?.end(input);
  });
}

const body = (o: Outbound) => JSON.stringify({ from: process.env.FIXIT_FROM_EMAIL ?? "fixit@example.com", to: [o.to], subject: o.subject, text: o.body });

/** Side-effect-free preview. Uses `swytchcode exec --dry-run` when configured, else a labelled export preview. */
export async function preview(jobId: string, o: Outbound): Promise<Preview> {
  if (!(o.action in ALLOWED_ACTIONS)) throw new Error("action not allow-listed");
  const key = idempotencyKey(jobId, o);
  if (!configured()) return { ...o, mode: "export-fallback", idempotencyKey: key, note: "Swytchcode not configured: preview/export only. Nothing will be delivered." };
  const r = await run(["exec", o.tool, "--dry-run", "--json", "--body", body(o), "--header", `Idempotency-Key=${key}`]);
  return { ...o, mode: r.code === 0 ? "swytchcode-dry-run" : "export-fallback", idempotencyKey: key, note: r.code === 0 ? "Swytchcode dry-run: no HTTP call made." : `Dry-run unavailable (${r.out.slice(0, 120)}); export only.` };
}

const recFile = (key: string) => path.join(/*turbopackIgnore: true*/ DIR, `exec-${key.replace(/[^a-f0-9]/g, "")}.json`);
const readRec = (key: string): ExecRecord | null => { try { return JSON.parse(readFileSync(recFile(key), "utf8")); } catch { return null; } };
function writeRec(r: ExecRecord) { try { const tmp = `${recFile(r.idempotencyKey)}.tmp`; writeFileSync(tmp, JSON.stringify(r)); renameSync(tmp, recFile(r.idempotencyKey)); } catch (e) { console.error("[governed] record write failed:", (e as Error).message); } }

/**
 * Execute once. Requires the AWS-54 job to hold a matching HUMAN approval and the execution claim,
 * where draftHash binds session + action + recipient + payload. A durable record keyed by the idempotency key
 * guarantees at most one effect; double-approve returns the same record. Timeouts => "unknown", never retried.
 */
export async function execute(job: FixitJob, o: Outbound, claimId: string): Promise<ExecRecord> {
  const key = idempotencyKey(job.id, o);
  const fresh = getJob(job.id) ?? job;
  const gate = actor.code("swytchcode-gate");
  const deny = (detail: string): ExecRecord => (audit(fresh, gate, `outbound blocked: ${detail}`, false, { key }), { idempotencyKey: key, jobId: job.id, status: "failed", detail: `blocked: ${detail}`, at: new Date().toISOString() });
  if (!(o.action in ALLOWED_ACTIONS) || ALLOWED_ACTIONS[o.action] !== o.tool) return deny("not allow-listed");
  if (!fresh.approval || fresh.claimId !== claimId) return deny("no matching approval/claim");
  if (fresh.draft !== canonical(o)) return deny("recipient or payload changed after approval");

  try {
    mkdirSync(DIR, { recursive: true });
    closeSync(openSync(recFile(key), "wx"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") return deny("execution record store unavailable");
    return readRec(key) ?? { idempotencyKey: key, jobId: job.id, status: "unknown", detail: "in flight", at: new Date().toISOString() };
  }
  let rec: ExecRecord;
  if (!configured()) {
    rec = { idempotencyKey: key, jobId: job.id, status: "not_sent_export", detail: "Swytchcode not configured: exported for manual send. Not delivered.", at: new Date().toISOString() };
  } else {
    const r = await run(["exec", o.tool, "--json", "--body", body(o), "--header", `Idempotency-Key=${key}`]);
    const id = r.out.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
    rec = r.timedOut
      ? { idempotencyKey: key, jobId: job.id, status: "unknown", detail: "timed out after dispatch; not retried", at: new Date().toISOString() }
      : r.code === 0 ? { idempotencyKey: key, jobId: job.id, status: "sent", providerId: id, detail: "Swytchcode exec ok", at: new Date().toISOString() }
      : { idempotencyKey: key, jobId: job.id, status: "failed", detail: r.out.replace(/(re_|sk_)[A-Za-z0-9_]+/g, "[redacted]").slice(0, 200), at: new Date().toISOString() };
  }
  writeRec(rec);
  audit(getJob(job.id) ?? fresh, gate, `outbound ${rec.status}`, rec.status === "sent" || rec.status === "not_sent_export", { key, providerId: rec.providerId });
  if (rec.status !== "unknown") finish(getJob(job.id) ?? fresh, gate, { result: rec.status, key });
  return rec;
}

/** Existing execution record for this job + payload (double-approve returns the same record). */
export const lookup = (jobId: string, o: Outbound) => readRec(idempotencyKey(jobId, o));
