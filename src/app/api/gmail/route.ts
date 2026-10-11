import { NextResponse } from "next/server";
import { Composio } from "@composio/core";
import { currentUser } from "@/lib/user";

export const maxDuration = 60;

// Gmail via Composio-managed OAuth: no Google Cloud app of our own. Each FixIt user id maps to a Composio user id.
const enabled = () => !!process.env.COMPOSIO_API_KEY;
const client = () => new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
const session = (uid: string) => client().create(uid, { toolkits: ["gmail"] });
// Best-effort idempotency per warm instance; the client also persists sent keys per user.
const sent = new Map<string, { at: number; to: string; id?: string }>();

async function status(uid: string) {
  const s = await session(uid);
  const t = (await s.toolkits()).items.find((x) => x.slug.toLowerCase() === "gmail");
  return { connected: !!t?.connection?.isActive, session: s };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ enabled: enabled(), connected: false });
  if (!enabled()) return NextResponse.json({ enabled: false, connected: false });
  try {
    const { connected } = await status(user.id);
    return NextResponse.json({ enabled: true, connected });
  } catch (e) {
    return NextResponse.json({ enabled: true, connected: false, error: msg(e) });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use your Gmail. Guests get a preview only." }, { status: 401 });
  if (!enabled()) return NextResponse.json({ error: "Gmail sending is not configured (COMPOSIO_API_KEY missing)." }, { status: 503 });
  const b: { action: "connect" | "send"; key?: string; to?: string; subject?: string; body?: string } = await req.json();
  try {
    if (b.action === "connect") {
      const origin = new URL(req.url).origin;
      const s = await session(user.id);
      const r = await s.authorize("gmail", { callbackUrl: `${origin}/?gmail=connected` });
      return NextResponse.json({ redirectUrl: r.redirectUrl });
    }
    const key = `${user.id}:${b.key}`;
    if (!b.key) return NextResponse.json({ error: "Missing approval key." }, { status: 400 });
    const prev = sent.get(key);
    if (prev) return NextResponse.json({ ok: true, duplicate: true, ...prev });
    if (!b.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to)) return NextResponse.json({ error: "Enter a valid landlord email." }, { status: 400 });
    const { connected, session: s } = await status(user.id);
    if (!connected) return NextResponse.json({ error: "Connect Gmail first." }, { status: 409 });
    sent.set(key, { at: Date.now(), to: b.to }); // reserve before sending so a double click can't double send
    const r = await s.execute("GMAIL_SEND_EMAIL", { recipient_email: b.to, subject: (b.subject || "Repair request").slice(0, 200), body: (b.body || "").slice(0, 10_000) });
    const ok = !(r as { error?: unknown }).error && (r as { successful?: boolean }).successful !== false;
    if (!ok) {
      sent.delete(key);
      return NextResponse.json({ error: `Gmail send failed: ${String((r as { error?: unknown }).error ?? "unknown error").slice(0, 200)}` }, { status: 502 });
    }
    const id = ((r as { data?: { id?: string; response_data?: { id?: string } } }).data?.response_data?.id ?? (r as { data?: { id?: string } }).data?.id) || undefined;
    const rec = { at: Date.now(), to: b.to, id };
    sent.set(key, rec);
    return NextResponse.json({ ok: true, ...rec });
  } catch (e) {
    if (b.action === "send") sent.delete(`${user.id}:${b.key}`);
    return NextResponse.json({ error: msg(e) }, { status: 502 });
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/ak_[A-Za-z0-9_-]+/g, "[key]").slice(0, 200);
