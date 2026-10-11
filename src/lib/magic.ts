import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Composio } from "@composio/core";
import { authSecret } from "@/lib/user";

// Magic-link tokens: HMAC(AUTH_SECRET, purpose-scoped) over {email, nonce, exp}. 15-minute expiry.
// Single use is enforced with a per-instance used-nonce set; on Vercel's multi-instance runtime a
// token could be replayed on a *different* warm instance within its 15 minutes. Accepted for the
// demo (the token only ever reaches the mailbox owner); a shared KV marker would close it.
export const TOKEN_TTL_MS = 15 * 60_000;
const key = () => createHmac("sha256", authSecret()).update("fixit-magic-link-v1").digest();
const mac = (v: string) => createHmac("sha256", key()).update(v).digest("base64url");
const used = new Map<string, number>();

export const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

export function issueToken(email: string) {
  const v = Buffer.from(JSON.stringify({ e: email, n: randomBytes(12).toString("base64url"), x: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${v}.${mac(v)}`;
}

export function consumeToken(token: string): string | null {
  const [v, s] = (token ?? "").split(".");
  if (!v || !s || token.length > 600) return null;
  const a = Buffer.from(mac(v)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let p: { e?: string; n?: string; x?: number };
  try { p = JSON.parse(Buffer.from(v, "base64url").toString()); } catch { return null; }
  const now = Date.now();
  if (!p.e || !p.n || typeof p.x !== "number" || p.x < now || !EMAIL_RE.test(p.e)) return null;
  for (const [n, x] of used) if (x < now) used.delete(n);
  if (used.has(p.n)) return null;
  used.set(p.n, p.x);
  return p.e;
}

// Light in-memory rate limit (per instance; a shared KV would make it global). IP and a sender-wide
// cap are checked before per-email buckets so many distinct emails can't evade the IP limit.
const hits = new Map<string, number[]>();
function over(k: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(k) ?? []).filter((t) => t > now - windowMs);
  if (arr.length >= max) { hits.set(k, arr); return true; }
  arr.push(now); hits.set(k, arr);
  if (hits.size > 5000) for (const [key, v] of hits) if (!v.some((t) => t > now - 3_600_000)) hits.delete(key); // evict stale only
  return false;
}
export function rateLimited(email: string, ip: string) {
  if (over(`ip:${ip}`, 15, 3_600_000) || over("global", 60, 3_600_000)) return "Too many sign-in links requested. Try again later.";
  if (over(`e30:${email}`, 1, 30_000)) return "Please wait 30 seconds before requesting another link.";
  if (over(`eh:${email}`, 5, 3_600_000)) return "Too many sign-in links requested. Try again later.";
  return null;
}

// Magic links are sent from the app owner's Gmail through Composio, under a fixed app-level
// Composio user id (never a FixIt end-user id, so no user can reach the mailer connection).
export const MAILER_ID = () => process.env.FIXIT_MAILER_USER_ID || "fixit-mailer";
const mailerSession = () => new Composio({ apiKey: process.env.COMPOSIO_API_KEY }).create(MAILER_ID(), { toolkits: ["gmail"] });
let cache: { at: number; ok: boolean } | null = null;

// Email sign-in is offered only when the mailer Gmail is actually connected (cached 60s per instance).
export async function emailSignInEnabled() {
  if (!process.env.COMPOSIO_API_KEY) return false;
  if (cache && Date.now() - cache.at < 60_000) return cache.ok;
  let ok = false;
  try {
    const t = (await (await mailerSession()).toolkits()).items.find((x) => x.slug.toLowerCase() === "gmail");
    ok = !!t?.connection?.isActive;
  } catch (e) { console.error("mailer status failed", String((e as Error).message).slice(0, 200)); }
  cache = { at: Date.now(), ok };
  return ok;
}
export const resetMailerCache = () => { cache = null; };

// Admin connect: only the sha256 of the random admin token lives in the repo.
const ADMIN_SHA = "3e8f25dccce31e4f702708049c9b1d88a4ac7e5cb36dabea4191bea30e79786e";
export function isAdmin(token: string | null) {
  const a = Buffer.from(createHash("sha256").update(token ?? "").digest("hex")), b = Buffer.from(ADMIN_SHA);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function connectMailer(callbackUrl: string) {
  return (await (await mailerSession()).authorize("gmail", { callbackUrl })).redirectUrl;
}

export async function sendMagicLink(to: string, link: string) {
  const body = `Sign in to FixIt:\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`;
  const r = await (await mailerSession()).execute("GMAIL_SEND_EMAIL", { recipient_email: to, subject: "Your FixIt sign-in link", body });
  const ok = !(r as { error?: unknown }).error && (r as { successful?: boolean }).successful !== false;
  if (!ok) {
    console.error("mailer send failed", String((r as { error?: unknown }).error ?? "").slice(0, 200));
    throw new Error("send failed");
  }
}
