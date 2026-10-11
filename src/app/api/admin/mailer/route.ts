import { NextResponse } from "next/server";
import { connectMailer, emailSignInEnabled, isAdmin, MAILER_ID, resetMailerCache } from "@/lib/magic";

// Admin-only, one-time: connect the app owner's Gmail as the magic-link sender.
// GET /api/admin/mailer?token=...          -> status
// GET /api/admin/mailer?token=...&connect=1 -> redirect to Composio/Google consent
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (!isAdmin(u.searchParams.get("token"))) return new Response("not found", { status: 404 });
  if (!process.env.COMPOSIO_API_KEY) return NextResponse.json({ error: "COMPOSIO_API_KEY missing" }, { status: 503 });
  resetMailerCache();
  if (u.searchParams.get("connect") === "1") {
    try {
      const url = await connectMailer(`${u.origin}/?mailer=connected`);
      if (!url) return NextResponse.json({ error: "Composio returned no redirect URL" }, { status: 502 });
      return NextResponse.redirect(url, 303);
    } catch (e) {
      return NextResponse.json({ error: String((e as Error).message).slice(0, 200) }, { status: 502 });
    }
  }
  return NextResponse.json({ mailerUserId: MAILER_ID(), connected: await emailSignInEnabled() }, { headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
