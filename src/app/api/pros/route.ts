import { NextResponse } from "next/server";
import { addPro, matchPros } from "@/lib/pros/store";
import { TRADES, type Trade } from "@/lib/pros/shared";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const t = TRADES.find((x) => x.toLowerCase() === (u.searchParams.get("trade") ?? "").toLowerCase()) ?? ("general" as Trade);
  const zip = (u.searchParams.get("zip") ?? "").replace(/\D/g, "").slice(0, 5);
  return NextResponse.json({ trade: t, zip, pros: matchPros(t, zip) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body && typeof body === "object" && body.website) return NextResponse.json({ ok: true }); // honeypot
  const r = addPro(body ?? {});
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, pro: { name: r.pro!.name, trade: r.pro!.trade, zip: r.pro!.zip } });
}
