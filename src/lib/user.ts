import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Minimal signed-cookie identity: a stable user id + display name/email, HMAC-signed so the
// id can't be forged to borrow someone else's Composio Gmail connection.
export type User = { id: string; name: string; email: string };
const COOKIE = "fixit_user";
const secret = () => process.env.AUTH_SECRET || process.env.COMPOSIO_API_KEY || "dev-only-secret";
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
  try { return JSON.parse(Buffer.from(v, "base64url").toString()); } catch { return null; }
}
// Same email -> same id, so history and Gmail connection follow the person across devices.
export const userIdFor = (email: string) => `fx_${createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("hex").slice(0, 24)}`;
export const newUser = (name: string, email: string): User => ({ id: email ? userIdFor(email) : `fx_${randomUUID()}`, name: name.trim().slice(0, 60), email: email.trim().toLowerCase().slice(0, 120) });
export const USER_COOKIE = COOKIE;
