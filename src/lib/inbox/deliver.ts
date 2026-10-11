import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { rename } from "node:fs/promises";
import { z } from "zod";
import { base44, base44Configured, inboxUrl } from "./base44";

export type InboxDraft = { title: string; urgency: string; category: string; body: string; planSummary?: string; photoUrl?: string; auditUrl?: string };
export type DeliveryState = "pending" | "delivered" | "unknown" | "export_only" | "rejected";
export type DeliveryRecord = {
  key: string; // idempotency key = sha256(session + draftHash)
  sessionId: string;
  draftHash: string;
  state: DeliveryState;
  draft: InboxDraft;
  receipt?: { base44Id: string; createdAt: string; url?: string };
  error?: string;
  audit: { at: string; actor: "HUMAN" | "CODE"; event: string; detail?: string }[];
  updatedAt: string;
};

export const DraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  urgency: z.enum(["low", "medium", "high", "emergency"]),
  category: z.string().max(40),
  body: z.string().trim().min(1).max(8000),
  planSummary: z.string().max(400).optional(),
});
// Every field that is sent to Base44 is part of the approved hash.
export const hashDraft = (d: InboxDraft) => createHash("sha256").update(JSON.stringify([d.title, d.urgency, d.category, d.body, d.planSummary ?? ""])).digest("hex");
const keyOf = (sessionId: string, draftHash: string) => createHash("sha256").update(`${sessionId}:${draftHash}`).digest("hex").slice(0, 32);

// Durable idempotency record + local fallback inbox. JSON file on disk (swap for Postgres in prod).
// On Vercel only /tmp is writable (not durable across instances: set INBOX_STORE_FILE or move to Postgres).
const FILE = process.env.INBOX_STORE_FILE ?? (process.env.VERCEL ? "/tmp/fixit-inbox.json" : path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "inbox.json"));
let lock: Promise<unknown> = Promise.resolve();
async function load(): Promise<Record<string, DeliveryRecord>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return {};
  }
}
async function save(db: Record<string, DeliveryRecord>) {
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, FILE); // atomic replace
  } catch (e) {
    console.error("[inbox] store write failed:", (e as Error).message);
  }
}
/** Serialize all mutations in-process so a double click cannot race two creates. */
function withLock<T>(fn: (db: Record<string, DeliveryRecord>) => Promise<T>): Promise<T> {
  const run = lock.then(async () => {
    const db = await load();
    try {
      return await fn(db);
    } finally {
      await save(db);
    }
  });
  lock = run.catch(() => undefined);
  return run;
}

export async function listDeliveries(sessionId: string) {
  const db = await load();
  return Object.values(db).filter((r) => r.sessionId === sessionId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const now = () => new Date().toISOString();
const audit = (r: DeliveryRecord, actor: "HUMAN" | "CODE", event: string, detail?: string) => {
  r.audit.push({ at: now(), actor, event, detail });
  r.updatedAt = now();
};

/** Governed dry run: validate the draft and check Base44 reachability without writing. */
export async function dryRun(draft: InboxDraft): Promise<{ ok: boolean; mode: "base44" | "export_only"; reason?: string }> {
  if (!draft.title?.trim() || !draft.body?.trim() || draft.body.length > 8000) return { ok: false, mode: "export_only", reason: "invalid draft" };
  if (!["low", "medium", "high", "emergency"].includes(draft.urgency)) return { ok: false, mode: "export_only", reason: "invalid urgency" };
  if (!base44Configured()) return { ok: true, mode: "export_only", reason: "Base44 not configured" };
  try {
    const c = await base44();
    await c.entities.Request.list("-created_date", 1);
    return { ok: true, mode: "base44" };
  } catch (e) {
    console.error("[inbox] base44 unreachable:", (e as Error).message);
    return { ok: true, mode: "export_only", reason: "Base44 unreachable right now" };
  }
}

/** Find an existing Base44 Request for this idempotency key (reconciliation after a lost response). */
async function reconcile(key: string) {
  const c = await base44();
  const found = (await c.entities.Request.filter({ idempotency_key: key })) as { id: string; created_date?: string }[];
  return found[0];
}

export type DeliverInput = { sessionId: string; draft: InboxDraft; draftHash: string; decision: "approved" | "rejected" };
export type DeliverResult = { status: number; record?: DeliveryRecord; error?: string };

export async function deliver({ sessionId, draft, draftHash, decision }: DeliverInput): Promise<DeliverResult> {
  if (hashDraft(draft) !== draftHash) return { status: 409, error: "Draft changed after approval. Re-approve the current draft." };
  const key = keyOf(sessionId, draftHash);

  // Claim under lock: decide whether this call may create.
  const claim = await withLock(async (db) => {
    const existing = db[key];
    if (existing && ["delivered", "export_only", "rejected"].includes(existing.state)) return { stop: { status: 200, record: existing } };
    if (existing?.state === "pending") return { stop: { status: 202, record: existing } }; // in flight elsewhere
    const r: DeliveryRecord = existing ?? { key, sessionId, draftHash, state: "pending", draft, audit: [], updatedAt: now() };
    if (decision === "rejected" && existing?.state === "unknown") return { stop: { status: 409, error: "Delivery status is unknown; it may already be in the inbox. Retry to reconcile first." } as DeliverResult };
    if (decision === "rejected") {
      r.state = "rejected";
      audit(r, "HUMAN", "rejected", `draft ${draftHash.slice(0, 12)}`);
      db[key] = r;
      return { stop: { status: 200, record: r } };
    }
    audit(r, "HUMAN", "approved", `draft ${draftHash.slice(0, 12)}`);
    const reconcileFirst = r.state === "unknown";
    r.state = "pending";
    db[key] = r;
    return { record: structuredClone(r), reconcileFirst };
  });
  if (claim.stop) return claim.stop;

  const dr = await dryRun(draft);
  const finish = (mut: (r: DeliveryRecord) => void) =>
    withLock(async (db) => {
      mut(db[key]);
      return { status: 200, record: db[key] } as DeliverResult;
    });
  if (!dr.ok) return finish((r) => ((r.state = "export_only"), (r.error = dr.reason), audit(r, "CODE", "dry_run_failed", dr.reason)));
  if (dr.mode === "export_only" && base44Configured()) return finish((r) => ((r.state = claim.reconcileFirst ? "unknown" : "export_only"), (r.error = dr.reason), audit(r, "CODE", "base44_unreachable", dr.reason)));
  if (dr.mode === "export_only") return finish((r) => ((r.state = "export_only"), (r.error = dr.reason), audit(r, "CODE", "stored_locally", dr.reason)));

  try {
    const c = await base44();
    // Always reconcile first: the local record is per-instance on Vercel, Base44 is the source of truth.
    let rec = await reconcile(key).catch(() => (claim.reconcileFirst ? Promise.reject(new Error("reconcile failed")) : undefined));
    if (!rec) {
      await finish((r) => audit(r, "CODE", "dry_run_ok", "Base44 reachable"));
      rec = (await c.entities.Request.create({
        title: draft.title,
        urgency: draft.urgency,
        category: draft.category,
        body: draft.body,
        plan_summary: draft.planSummary ?? "",
        status: "new",
        draft_hash: draftHash,
        idempotency_key: key,
        source: "FixIt",
      })) as { id: string; created_date?: string };
    }
    const receipt = { base44Id: rec.id, createdAt: rec.created_date ?? now(), url: inboxUrl(rec.id) };
    // Linked audit trail in Base44 (best effort; the receipt is what confirms delivery).
    const events = [
      { actor: "HUMAN", event: "approved" },
      { actor: "CODE", event: "delivered" },
    ];
    await Promise.allSettled(events.map((e) => c.entities.AuditEvent.create({ request_id: rec!.id, actor: e.actor, event: e.event, draft_hash: draftHash, idempotency_key: key })));
    return finish((r) => ((r.state = "delivered"), (r.receipt = receipt), (r.error = undefined), audit(r, "CODE", "delivered", `Base44 receipt ${rec!.id}`)));
  } catch (e) {
    // Response lost or failed: we cannot know whether Base44 created it. Never show success; reconcile next time.
    console.error("[inbox] delivery error:", (e as Error).message);
    return finish((r) => ((r.state = "unknown"), (r.error = "No confirmed receipt from Base44."), audit(r, "CODE", "delivery_unknown", r.error)));
  }
}
