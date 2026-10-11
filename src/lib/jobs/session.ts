import { randomUUID } from "node:crypto";

/** Server-issued anonymous demo session (no login for judges). */
export const SESSION_COOKIE = "fixit_sid";

export function readSession(req: Request): { id: string; fresh: boolean } {
  const m = (req.headers.get("cookie") ?? "").match(/(?:^|;\s*)fixit_sid=([a-f0-9-]{36})/);
  return m ? { id: m[1], fresh: false } : { id: randomUUID(), fresh: true };
}

export const sessionHeader = (id: string) => `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
