import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Minimal signed-cookie identity: a stable user id + display name/email, HMAC-signed so the
// id can't be forged to borrow someone else's Composio Gmail connection.
// v:2 marks an email-verified (magic-link) identity. Older cookies minted by the unverified
// name+email form are rejected, and verified ids use a new "fxv_" namespace so any Composio Gmail
// session created under an old, forgeable id is cleanly abandoned (never inherited).
export type User = { id: string; name: string; email: string; v?: 2; exp?: number };
const COOKIE = "fixit_user";
// Fail closed in production: never sign sessions/magic links with a public fallback key.
const secret = () => {
  const s = process.env.AUTH_SECRET || process.env.COMPOSIO_API_KEY;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET missing");
  return "dev-only-secret";
};
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function encodeUser(u: User) {
  const v = Buffer.from(JSON.stringify(u)).toString("base64url");
  return `${v}.${sign(v)}`;
}
export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [v, s] = raw.split(".");
  if (!v || !s) return null;
  const a = Buffer.from(sign(v)), b = Buffer.from(s);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const u = JSON.parse(Buffer.from(v, "base64url").toString()) as User;
    return u.v === 2 && u.id.startsWith("fxv_") && typeof u.exp === "number" && u.exp > Date.now() ? u : null; // server-enforced 30-day expiry
  } catch { return null; }
}
// Same email -> same id, so history and Gmail connection follow the person across devices.
export const userIdFor = (email: string) => `fxv_${createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("hex").slice(0, 24)}`;
export const verifiedUser = (email: string): User => {
  const e = email.trim().toLowerCase().slice(0, 120);
  return { id: userIdFor(e), name: e.split("@")[0].slice(0, 60), email: e, v: 2, exp: Date.now() + 30 * 86_400_000 };
};
export const authSecret = secret;
export const USER_COOKIE = COOKIE;
