import { Composio } from "@composio/core";

// Shared Gmail (Composio) send used by the approval flow and /api/gmail. One send per (user, approval key).
export const gmailEnabled = () => !!process.env.COMPOSIO_API_KEY;
const session = (uid: string) => new Composio({ apiKey: process.env.COMPOSIO_API_KEY }).create(uid, { toolkits: ["gmail"] });
export type SendRec = { at: number; to: string; id?: string };
// Best-effort idempotency per warm instance; the approval claim (job store) is the cross-instance single-execution guard.
const g = globalThis as unknown as { __fixitSent?: Map<string, SendRec | "pending"> };
const sent = (g.__fixitSent ??= new Map());
export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function gmailStatus(uid: string) {
  const s = await session(uid);
  const t = (await s.toolkits()).items.find((x) => x.slug.toLowerCase() === "gmail");
  return { connected: !!t?.connection?.isActive, session: s };
}

export async function gmailConnectUrl(uid: string, callbackUrl: string) {
  return (await (await session(uid)).authorize("gmail", { callbackUrl })).redirectUrl;
}

export async function sendOnce(uid: string, key: string, mail: { to: string; subject: string; body: string }): Promise<{ ok: true; duplicate?: boolean; rec: SendRec } | { ok: false; error: string; status: number }> {
  const k = `${uid}:${key}`;
  const prev = sent.get(k);
  if (prev === "pending") return { ok: false, error: "Already sending; it goes out once.", status: 409 };
  if (prev) return { ok: true, duplicate: true, rec: prev };
  if (!EMAIL_OK.test(mail.to)) return { ok: false, error: "Enter a valid landlord email.", status: 400 };
  sent.set(k, "pending"); // reserve before sending so a double click can't double send
  try {
    let st: Awaited<ReturnType<typeof gmailStatus>>;
    try { st = await gmailStatus(uid); } catch (e) { sent.delete(k); return { ok: false, error: msg(e), status: 502 }; }
    const { connected, session: s } = st;
    if (!connected) { sent.delete(k); return { ok: false, error: "Connect Gmail first.", status: 409 }; }
    const r = await s.execute("GMAIL_SEND_EMAIL", { recipient_email: mail.to, subject: (mail.subject || "Repair request").slice(0, 200), body: (mail.body || "").slice(0, 10_000) });
    const ok = !(r as { error?: unknown }).error && (r as { successful?: boolean }).successful !== false;
    if (!ok) { sent.delete(k); return { ok: false, error: `Gmail send failed: ${String((r as { error?: unknown }).error ?? "unknown error").slice(0, 200)}`, status: 502 }; }
    const d = (r as { data?: { id?: string; response_data?: { id?: string } } }).data;
    const rec = { at: Date.now(), to: mail.to, id: d?.response_data?.id ?? d?.id ?? undefined };
    sent.set(k, rec);
    return { ok: true, rec };
  } catch (e) {
    // The request may have reached Gmail: keep the reservation (no automatic resend) and report "unknown".
    return { ok: false, error: `Delivery not confirmed (${msg(e)}).`, status: 504 };
  }
}

export const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/ak_[A-Za-z0-9_-]+/g, "[key]").slice(0, 200);

// AWS-72: Profile "Connect Gmail" status: connected address and disconnect.
const client = () => new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const emails = new Map<string, string>();
export async function gmailAccount(uid: string) {
  const { connected, session: s } = await gmailStatus(uid);
  if (!connected) { emails.delete(uid); return { connected: false as const }; }
  let email = emails.get(uid);
  if (!email) {
    try {
      const r = await s.execute("GMAIL_GET_PROFILE", { user_id: "me" });
      const d = (r as { data?: { emailAddress?: string; response_data?: { emailAddress?: string } } }).data;
      email = d?.emailAddress ?? d?.response_data?.emailAddress ?? "";
      if (email) emails.set(uid, email);
    } catch {}
  }
  return { connected: true as const, email: email || undefined };
}
export async function gmailDisconnect(uid: string) {
  const list = await client().connectedAccounts.list({ userIds: [uid], toolkitSlugs: ["gmail"] });
  const items = (list as { items?: { id: string }[] }).items ?? [];
  for (const a of items) await client().connectedAccounts.delete(a.id);
  emails.delete(uid);
  return items.length;
}
