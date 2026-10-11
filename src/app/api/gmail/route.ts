import { NextResponse } from "next/server";
import { currentUser } from "@/lib/user";
import { gmailAccount, gmailConnectUrl, gmailDisconnect, gmailEnabled, msg, sendOnce } from "@/lib/gmail-send";

export const maxDuration = 60;

// Gmail via Composio-managed OAuth: no Google Cloud app of our own. Each FixIt user id maps to a Composio user id.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ enabled: gmailEnabled(), connected: false });
  if (!gmailEnabled()) return NextResponse.json({ enabled: false, connected: false });
  try {
    return NextResponse.json({ enabled: true, ...(await gmailAccount(user.id)) });
  } catch (e) {
    return NextResponse.json({ enabled: true, connected: false, error: msg(e) });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to use your Gmail. Guests get a preview only." }, { status: 401 });
  if (!gmailEnabled()) return NextResponse.json({ error: "Gmail sending is not configured (COMPOSIO_API_KEY missing)." }, { status: 503 });
  const b: { action: "connect" | "send" | "disconnect"; key?: string; to?: string; subject?: string; body?: string } = await req.json();
  try {
    if (b.action === "connect") return NextResponse.json({ redirectUrl: await gmailConnectUrl(user.id, `${new URL(req.url).origin}/?gmail=connected`) });
    if (b.action === "disconnect") return NextResponse.json({ ok: true, removed: await gmailDisconnect(user.id) });
    if (b.action !== "send") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    if (!b.key) return NextResponse.json({ error: "Missing approval key." }, { status: 400 });
    const r = await sendOnce(user.id, b.key, { to: b.to ?? "", subject: b.subject ?? "", body: b.body ?? "" });
    return r.ok ? NextResponse.json({ ok: true, duplicate: r.duplicate, ...r.rec }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 502 });
  }
}
