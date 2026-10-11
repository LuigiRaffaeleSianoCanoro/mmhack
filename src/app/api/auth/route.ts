import { NextResponse } from "next/server";
import { currentUser, encodeUser, newUser, USER_COOKIE } from "@/lib/user";

export async function GET() {
  return NextResponse.json({ user: await currentUser() });
}

export async function POST(req: Request) {
  const { name, email }: { name?: string; email?: string } = await req.json().catch(() => ({}));
  const e = (email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const user = newUser(name || e.split("@")[0], e);
  const res = NextResponse.json({ user });
  res.cookies.set(USER_COOKIE, encodeUser(user), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(USER_COOKIE);
  return res;
}
