import { cookies } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import { deliver, DraftSchema, hashDraft, listDeliveries } from "@/lib/inbox/deliver";

const COOKIE = "fixit_sid";

async function session() {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id) {
    id = randomUUID();
    jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  }
  // Same one-way session key as the job store: the raw cookie value is never persisted.
  return createHash("sha256").update(`fixit-sid:${id}`).digest("hex").slice(0, 32);
}

/** GET: this session's deliveries (local inbox / receipts). */
export async function GET() {
  return Response.json({ deliveries: await listDeliveries(await session()) });
}

/** POST { draft, draftHash, decision }: deliver an approved draft once, bound to this session and draft hash. */
export async function POST(req: Request) {
  const sessionId = await session();
  const body = (await req.json().catch(() => null)) as { draft?: unknown; draftHash?: string; decision?: "approved" | "rejected"; hashOnly?: boolean } | null;
  const parsed = DraftSchema.safeParse(body?.draft);
  if (!body || !parsed.success) return Response.json({ error: "invalid draft" }, { status: 400 });
  const draft = parsed.data;
  if (body.hashOnly) return Response.json({ draftHash: hashDraft(draft) });
  if (!body.draftHash || (body.decision !== "approved" && body.decision !== "rejected")) return Response.json({ error: "missing draftHash/decision" }, { status: 400 });
  const r = await deliver({ sessionId, draft, draftHash: String(body.draftHash), decision: body.decision });
  return Response.json(r.record ? { record: r.record } : { error: r.error }, { status: r.status });
}
