import { NextResponse } from "next/server";
import { encodeUser, USER_COOKIE, verifiedUser } from "@/lib/user";
import { consumeToken } from "@/lib/magic";

// GET only renders a confirm button: mail scanners/link previewers prefetch GETs, and a GET that
// consumed the single-use token would burn it before the person clicks. The POST consumes it.
const page = (body: string) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>FixIt sign-in</title></head><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f5f2ee;margin:0"><main style="background:#fff;padding:28px;border-radius:14px;max-width:360px;text-align:center;box-shadow:0 10px 30px #0002">${body}</main></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "referrer-policy": "no-referrer" } },
  );
const forbidden = (why: string) => {
  console.warn("[auth/verify] forbidden:", why);
  return page(`<h1 style="margin:0 0 8px">Couldn't sign you in</h1><p style="color:#555">Open the link in the same browser and tap Continue, or <a href="/">request a new link</a>.</p>`);
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return NextResponse.redirect(new URL("/", req.url), 303);
  return page(`<h1 style="margin:0 0 8px">Sign in to FixIt</h1><p style="color:#555">Tap to finish signing in on this device.</p><form method="post" action="/api/auth/verify"><input type="hidden" name="token" value="${esc(token)}"><button style="margin-top:12px;padding:12px 20px;font-size:16px;border:0;border-radius:10px;background:#111;color:#fff;cursor:pointer" type="submit">Continue</button></form>`);
}

export async function POST(req: Request) {
  // Login-CSRF guard: only accept the confirm form posted from our own origin.
  // The confirm page sets referrer-policy: no-referrer, so browsers send `Origin: null` on this POST.
  // Treat "null" as absent and rely on Sec-Fetch-Site (sent by all modern browsers) instead.
  const raw = req.headers.get("origin");
  const origin = raw && raw !== "null" ? raw : null;
  const site = req.headers.get("sec-fetch-site");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const self = new Set([new URL(req.url).origin, host ? `https://${host}` : ""]);
  if (origin && !self.has(origin)) return forbidden(`origin ${origin}`);
  if (site && site !== "same-origin" && site !== "none") return forbidden(`sec-fetch-site ${site}`);
  const token = String((await req.formData().catch(() => null))?.get("token") ?? "");
  const email = consumeToken(token);
  if (!email) return page(`<h1 style="margin:0 0 8px">Link expired</h1><p style="color:#555">This sign-in link was already used or is older than 15 minutes.</p><p><a href="/">Back to FixIt</a> to request a new one.</p>`);
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(USER_COOKIE, encodeUser(verifiedUser(email)), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
