import { createHash } from "node:crypto";
import { execFile, spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { getJob, audit, finish, releaseClaim, type FixitJob } from "@/lib/jobs/store";
import { actor } from "@/lib/jobs/workflow";

/**
 * AWS-55: one governed outbound action, routed through the Swytchcode kernel (`swytchcode exec`).
 * Allow-list lives in /tooling.json. The approved artifact is the complete payload including the
 * delivery mode, sender and recipient, so an "export" approval can never turn into a real send.
 */
export const ALLOWED_ACTIONS = { "notify-landlord": "resend.emails.send" } as const;
export type ActionName = keyof typeof ALLOWED_ACTIONS;
const CATEGORIES = ["plumbing", "electrical", "gas", "appliance", "hvac", "pest", "structural", "general", "repair", "hazard"];

export type Outbound = { action: ActionName; tool: string; mode: "send" | "export"; from: string; to: string; subject: string; body: string };
export type Preview = Outbound & { note: string; idempotencyKey: string };
export type ExecRecord = { idempotencyKey: string; jobId: string; status: "sent" | "unknown" | "failed" | "not_sent_export" | "in_flight"; providerId?: string; detail: string; at: string };

const BIN = process.env.SWYTCHCODE_BIN ?? "swytchcode";
const TIMEOUT_MS = Math.min(30000, Math.max(1000, Number(process.env.SWYTCHCODE_TIMEOUT_MS) || 15000));
const DIR = process.env.FIXIT_DATA_DIR ?? (process.env.VERCEL ? "/tmp/fixit-jobs" : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "jobs"));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const canonical = (o: Outbound) => JSON.stringify({ action: o.action, tool: o.tool, mode: o.mode, from: o.from, to: o.to, subject: o.subject, body: o.body });
export const idempotencyKey = (jobId: string, o: Outbound) => createHash("sha256").update(`${jobId}\n${canonical(o)}`).digest("hex").slice(0, 32);

let binOk: boolean | undefined;
/** Real delivery only when explicitly enabled, the kernel binary exists, and sender + recipient are configured. */
export function deliveryReady(): boolean {
  if (process.env.SWYTCHCODE_ENABLED !== "1") return false;
  if (!EMAIL.test(process.env.LANDLORD_EMAIL ?? "") || !EMAIL.test(process.env.FIXIT_FROM_EMAIL ?? "")) return false;
  if (binOk === undefined) {
    try { binOk = spawnSync(BIN, ["--version"], { timeout: 3000, env: childEnv() }).status === 0; } catch { binOk = false; }
  }
  return binOk;
}

// Untrusted report text: strip links/markdown so the email cannot carry phishing links or image beacons.
const clean = (s: string, n: number) => s.replace(/https?:\/\/\S+|www\.\S+/gi, "[link removed]").replace(/[`*_#>![\]<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

/** Optional renter details from FixIt memory. Used only in this deterministic template, never in a model prompt. */
export type Renter = { address?: string; landlordName?: string; landlordEmail?: string; phone?: string; notes?: string };

export function buildOutbound(report: string, category: string, hazard = true, renter: Renter = {}): Outbound {
  const cat = CATEGORIES.includes(category) ? category : "repair";
  const mode = deliveryReady() ? "send" : "export";
  // Recipient and sender are pinned server-side (env), never taken from model or user output.
  // Export mode: the profile's landlord address is shown as the suggested recipient (nothing is sent from here).
  const to = mode === "send" ? process.env.LANDLORD_EMAIL! : EMAIL.test(renter.landlordEmail ?? "") ? renter.landlordEmail! : "your landlord";
  const from = mode === "send" ? process.env.FIXIT_FROM_EMAIL! : "you";
  const issue = clean(report, 400);
  const name = clean(renter.landlordName ?? "", 80);
  const hello = name ? `Hello ${name},` : "Hello,";
  const addr = clean(renter.address ?? "", 160);
  const at = addr ? `my unit at ${addr}` : "my unit";
  const extra = [renter.phone ? `You can reach me at ${clean(renter.phone, 30)}.` : "", renter.notes ? `Access notes: ${clean(renter.notes, 300)}` : ""].filter(Boolean).join("\n");
  const tail = extra ? `\n${extra}\n` : "";
  return {
    action: "notify-landlord",
    tool: ALLOWED_ACTIONS["notify-landlord"],
    mode,
    from,
    to,
    subject: hazard ? `Urgent repair request: possible ${cat} hazard` : `Repair request: ${cat}`,
    body: hazard
      ? `${hello}\n\nI am reporting an urgent ${cat} issue at ${at}: "${issue}".\nThis may be a safety hazard. Please send a licensed professional within 24 hours.\n${tail}\nThank you.`
      : `${hello}\n\nI am reporting a ${cat} issue at ${at}: "${issue}".\nCould you arrange a repair at your earliest convenience? I can share photos and availability.\n${tail}\nThank you.`,
  };
}

/** Minimal environment for the third-party CLI: no model keys or session secrets. */
function childEnv(): NodeJS.ProcessEnv {
  const e = { PATH: process.env.PATH, HOME: process.env.HOME } as unknown as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith("SWYTCHCODE_") || k.startsWith("RESEND_")) e[k] = v;
  return e;
}

function run(args: string[]): Promise<{ code: number | string | null; out: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    execFile(BIN, args, { timeout: TIMEOUT_MS, cwd: process.cwd(), env: childEnv() }, (err, stdout, stderr) => {
      const e = err as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
      resolve({ code: e ? (e.code ?? -1) : 0, out: `${stdout}`.slice(0, 4000), timedOut: !!e?.killed });
      if (e) console.error("[governed] swytchcode error:", String(stderr).slice(0, 500));
    });
  });
}

const payload = (o: Outbound) => JSON.stringify({ from: o.from, to: [o.to], subject: o.subject, text: o.body });

/** Side-effect-free preview, built locally from the exact payload that Approve will act on. */
export function preview(jobId: string, o: Outbound): Preview {
  return { ...o, idempotencyKey: idempotencyKey(jobId, o), note: o.mode === "send" ? `Approve sends this email via Swytchcode (${o.tool}), once.` : "Swytchcode delivery not configured: preview/export only. Nothing will be sent." };
}

const recFile = (key: string) => path.join(/*turbopackIgnore: true*/ DIR, `exec-${key.replace(/[^a-f0-9]/g, "")}.json`);
const readRec = (key: string): ExecRecord | null => { try { return JSON.parse(readFileSync(recFile(key), "utf8")); } catch { return null; } };
function writeRec(r: ExecRecord) {
  try { const tmp = `${recFile(r.idempotencyKey)}.tmp`; writeFileSync(tmp, JSON.stringify(r)); renameSync(tmp, recFile(r.idempotencyKey)); }
  catch (e) { console.error("[governed] record write failed:", (e as Error).message); }
}

/**
 * Execute once. Requires the AWS-54 job to hold a matching HUMAN approval and the execution claim.
 * Within an instance, an exclusive record file guarantees one dispatch; across Vercel instances the
 * provider Idempotency-Key is the second layer (a shared KV is the production fix). Ambiguous => "unknown", never retried.
 */
export async function execute(job: FixitJob, o: Outbound, claimId: string): Promise<ExecRecord> {
  const key = idempotencyKey(job.id, o);
  const fresh = getJob(job.id) ?? job;
  const gate = actor.code("swytchcode-gate");
  const now = () => new Date().toISOString();
  const deny = (detail: string): ExecRecord => (audit(fresh, gate, `outbound blocked: ${detail}`, false, { key }), { idempotencyKey: key, jobId: job.id, status: "failed", detail: `blocked: ${detail}`, at: now() });
  if (!(o.action in ALLOWED_ACTIONS) || ALLOWED_ACTIONS[o.action] !== o.tool) return deny("not allow-listed");
  if (!fresh.approval || fresh.claimId !== claimId) return deny("no matching approval/claim");
  if (o.mode === "send" && (o.to !== process.env.LANDLORD_EMAIL || o.from !== process.env.FIXIT_FROM_EMAIL)) return deny("recipient or sender no longer matches server config");

  if (o.mode === "export") {
    const rec: ExecRecord = { idempotencyKey: key, jobId: job.id, status: "not_sent_export", detail: "Export only (approved as export). Not delivered.", at: now() };
    try { mkdirSync(DIR, { recursive: true }); } catch {}
    writeRec(rec);
    audit(fresh, gate, "outbound exported (not sent)", true, { key });
    finish(getJob(job.id) ?? fresh, gate, { result: rec.status, key });
    return rec;
  }
  if (!deliveryReady()) {
    releaseClaim(getJob(job.id) ?? fresh, gate, "delivery not available");
    return { idempotencyKey: key, jobId: job.id, status: "failed", detail: "Delivery is not available right now. Nothing was sent.", at: now() };
  }
  try {
    mkdirSync(DIR, { recursive: true });
    const fd = openSync(recFile(key), "wx");
    writeFileSync(fd, JSON.stringify({ idempotencyKey: key, jobId: job.id, status: "in_flight", detail: "dispatching", at: now() } satisfies ExecRecord));
    closeSync(fd);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") return deny("execution record store unavailable");
    return readRec(key) ?? { idempotencyKey: key, jobId: job.id, status: "in_flight", detail: "already dispatching", at: now() };
  }
  const r = await run(["exec", o.tool, "--json", "--body", payload(o), "--header", `Idempotency-Key=${key}`]);
  if (r.code === "ENOENT") {
    // Never dispatched: release so the human can retry later.
    try { rmSync(recFile(key), { force: true }); } catch {}
    releaseClaim(getJob(job.id) ?? fresh, gate, "swytchcode binary missing");
    return { idempotencyKey: key, jobId: job.id, status: "failed", detail: "Delivery tool unavailable. Nothing was sent.", at: now() };
  }
  let id: string | undefined;
  try { const j = JSON.parse(r.out); id = j?.id ?? j?.data?.id; } catch {}
  const rec: ExecRecord = r.code === 0 && id
    ? { idempotencyKey: key, jobId: job.id, status: "sent", providerId: id, detail: "Swytchcode exec ok", at: now() }
    : { idempotencyKey: key, jobId: job.id, status: "unknown", detail: r.timedOut ? "timed out after dispatch; not retried" : "no confirmed provider result; not retried", at: now() };
  writeRec(rec);
  audit(getJob(job.id) ?? fresh, gate, `outbound ${rec.status}`, rec.status === "sent", { key, providerId: rec.providerId });
  if (rec.status === "sent") finish(getJob(job.id) ?? fresh, gate, { result: rec.status, key });
  return rec;
}

/** Existing execution record for this job + payload (double-approve returns the same record). */
export const lookup = (jobId: string, o: Outbound) => readRec(idempotencyKey(jobId, o));
