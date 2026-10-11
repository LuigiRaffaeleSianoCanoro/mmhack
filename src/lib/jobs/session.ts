import { createHash, randomUUID } from "node:crypto";

/** Server-issued anonymous demo session (no login for judges). */
export const SESSION_COOKIE = "fixit_sid";

/** `id` is the HttpOnly cookie value (never leaves the cookie); `key` is a one-way hash used in jobs, audits and tokens. */
export function readSession(req: Request): { id: string; key: string; fresh: boolean } {
  const m = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)fixit_sid=([a-f0-9-]{36})/);
  const id = m ? m[1] : randomUUID();
  return { id, key: createHash("sha256").update(`fixit-sid:${id}`).digest("hex").slice(0, 32), fresh: !m };
}

export const sessionHeader = (id: string) => `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.VERCEL ? "; Secure" : ""}`;
