import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { TRADES, type Pro, type PublicPro, type Trade } from "./shared";

/**
 * Simple server store for pro signups: a JSON file (same pattern as jobs/store.ts, /tmp on Vercel,
 * so signups are per-instance and not durable across deploys). Demo pros are seeded in code and labelled.
 */
const DIR = process.env.FIXIT_DATA_DIR ?? (process.env.VERCEL ? "/tmp/fixit-jobs" : path.join(/*turbopackIgnore: true*/ process.cwd(), ".data"));
const FILE = path.join(/*turbopackIgnore: true*/ DIR, "pros.json");

const demo = (id: string, name: string, trade: Trade, zip: string, area: string, rateNotes: string): Pro => ({ id: `demo-${id}`, name, trade, zip, area, phone: "", email: "", rateNotes, demo: true, createdAt: "2026-10-11T00:00:00Z" });
export const DEMO_PROS: Pro[] = [
  demo("hvac", "Canyon Air (Demo pro)", "HVAC", "90210", "Beverly Hills, West Hollywood", "Demo listing: rates not real."),
  demo("plumb", "Rodeo Plumbing (Demo pro)", "plumbing", "90211", "Beverly Hills, Beverlywood", "Demo listing: rates not real."),
  demo("elec", "Sunset Electric (Demo pro)", "electrical", "90069", "West Hollywood, Beverly Hills", "Demo listing: rates not real."),
  demo("dry", "Benedict Drywall (Demo pro)", "drywall", "90210", "Beverly Hills, Bel Air", "Demo listing: rates not real."),
  demo("roof", "Hillcrest Roofing (Demo pro)", "roofing", "90212", "Beverly Hills, Century City", "Demo listing: rates not real."),
  demo("appl", "Wilshire Appliance Repair (Demo pro)", "appliance", "90048", "Mid-Wilshire, Beverly Hills", "Demo listing: rates not real."),
  demo("gen", "Coldwater Handyman (Demo pro)", "general", "90210", "Beverly Hills", "Demo listing: rates not real."),
];

function readAll(): Pro[] {
  try { return JSON.parse(readFileSync(FILE, "utf8")) as Pro[]; } catch { return []; }
}
const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export function addPro(input: Record<string, unknown>): { pro?: Pro; error?: string } {
  const trade = TRADES.find((t) => t.toLowerCase() === s(input.trade, 20).toLowerCase());
  const pro: Pro = { id: randomUUID(), name: s(input.name, 80), trade: trade ?? "general", zip: s(input.zip, 10).replace(/[^0-9]/g, "").slice(0, 5), area: s(input.area, 120), phone: s(input.phone, 30), email: s(input.email, 120), rateNotes: s(input.rateNotes, 300), demo: false, createdAt: new Date().toISOString() };
  if (!pro.name) return { error: "Name is required." };
  if (!trade) return { error: "Pick a trade." };
  if (pro.zip.length !== 5) return { error: "Enter a 5-digit ZIP." };
  if (!/^\S+@\S+\.\S+$/.test(pro.email)) return { error: "Enter a valid email." };
  if (pro.phone.replace(/\D/g, "").length < 10) return { error: "Enter a phone number with area code." };
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${randomUUID()}.tmp`;
    writeFileSync(tmp, JSON.stringify([...readAll(), pro].slice(-500), null, 2));
    renameSync(tmp, FILE);
  } catch (e) {
    return { error: `Could not save right now (${(e as Error).message}).` };
  }
  return { pro };
}

/** Match by trade, then ZIP closeness (numeric distance is a coarse proxy, fine for a v0). Contact details are not returned. */
export function matchPros(trade: Trade, zip: string, limit = 3): PublicPro[] {
  const z = Number(zip) || 90210;
  const all = [...readAll(), ...DEMO_PROS];
  const score = (p: Pro) => (p.trade === trade ? 0 : p.trade === "general" ? 1 : 9) * 100000 + Math.abs((Number(p.zip) || 0) - z) + (p.demo ? 0.5 : 0);
  return all
    .filter((p) => p.trade === trade || p.trade === "general")
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit)
    .map(({ email: _e, phone: _p, ...rest }) => rest);
}
