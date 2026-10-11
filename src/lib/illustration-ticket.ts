import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IllustrationRequest } from "./illustration";

// Server-issued, signed, short-lived ticket: only reports that /api/fixit judged eligible can spend image budget.
const KEY = process.env.FIXIT_JOB_SECRET || (process.env.NEON_AI_GATEWAY_TOKEN ? createHash("sha256").update(`fixit-illus:${process.env.NEON_AI_GATEWAY_TOKEN}`).digest("hex") : "");
const TTL_MS = 15 * 60_000;
const mac = (b: string) => createHmac("sha256", KEY).update(b).digest("base64url");

export function issueTicket(r: Omit<IllustrationRequest, "ticket">): string | undefined {
  if (!KEY) return undefined;
  const b = Buffer.from(JSON.stringify({ c: r.category, s: r.summary, m: r.mode, e: Date.now() + TTL_MS })).toString("base64url");
  return `${b}.${mac(b)}`;
}

export function readTicket(t: unknown): { category: string; summary: string; mode: "live" | "sample" } | null {
  if (!KEY || typeof t !== "string" || t.length > 4000) return null;
  const [b, sig] = t.split(".");
  if (!b || !sig) return null;
  const want = Buffer.from(mac(b)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const j = JSON.parse(Buffer.from(b, "base64url").toString("utf8"));
    if (typeof j.e !== "number" || j.e < Date.now()) return null;
    return { category: String(j.c), summary: String(j.s ?? ""), mode: j.m === "sample" ? "sample" : "live" };
  } catch {
    return null;
  }
}
