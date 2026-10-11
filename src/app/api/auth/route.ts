import { NextResponse } from "next/server";
import { currentUser, USER_COOKIE } from "@/lib/user";
import { EMAIL_RE, emailSignInEnabled, issueToken, rateLimited, sendMagicLink } from "@/lib/magic";

export async function GET() {
  try { await currentUser(); } catch { return NextResponse.json({ user: null, emailSignIn: false }); }
  return NextResponse.json({ user: await currentUser(), emailSignIn: await emailSignInEnabled() });
}

// Request a magic link. Never signs anyone in directly.
export async function POST(req: Request) {
  if (!(await emailSignInEnabled())) return NextResponse.json({ error: "Email sign-in is not available. Continue as guest." }, { status: 503 });
  const { email }: { email?: string } = await req.json().catch(() => ({}));
  const e = (email ?? "").trim().toLowerCase();
  if (e.length > 120 || !EMAIL_RE.test(e)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const limited = rateLimited(e, ip);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  // Link origin from the request URL (Vercel sets it to the served host); not from client-supplied body.
  const link = `${new URL(req.url).origin}/api/auth/verify?token=${encodeURIComponent(issueToken(e))}`;
  try { await sendMagicLink(e, link); } catch { return NextResponse.json({ error: "Couldn't send the email. Try again shortly." }, { status: 502 }); }
  return NextResponse.json({ sent: true });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(USER_COOKIE);
  return res;
}
