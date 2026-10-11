"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/fixit/mascot";

export type Who = { id: string; name: string; email: string; guest: boolean };
type Gmail = { enabled: boolean; connected: boolean };
type Ctx = { who: Who; gmail: Gmail; refreshGmail: () => Promise<void>; signOut: () => Promise<void> };
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => useContext(AuthCtx);
const GUEST_KEY = "fixit.guest";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [who, setWho] = useState<Who | null | undefined>(undefined);
  const [gmail, setGmail] = useState<Gmail>({ enabled: false, connected: false });
  const refreshGmail = useCallback(async () => {
    try { setGmail(await (await fetch("/api/gmail", { cache: "no-store" })).json()); } catch {}
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const { user } = await (await fetch("/api/auth", { cache: "no-store" })).json();
        if (user) { setWho({ ...user, guest: false }); refreshGmail(); return; }
      } catch {}
      setWho(localStorage.getItem(GUEST_KEY) ? { id: "guest", name: "Guest", email: "", guest: true } : null);
    })();
  }, [refreshGmail]);
  const signOut = async () => {
    localStorage.removeItem(GUEST_KEY);
    await fetch("/api/auth", { method: "DELETE" });
    setGmail({ enabled: false, connected: false });
    setWho(null);
  };
  if (who === undefined) return <div className="h-dvh" />;
  if (who === null)
    return (
      <Login
        onGuest={() => { localStorage.setItem(GUEST_KEY, "1"); setWho({ id: "guest", name: "Guest", email: "", guest: true }); }}
        onUser={(u) => { setWho({ ...u, guest: false }); refreshGmail(); }}
      />
    );
  return <AuthCtx.Provider value={{ who, gmail, refreshGmail, signOut }}>{children}</AuthCtx.Provider>;
}

function Login({ onGuest, onUser }: { onGuest: () => void; onUser: (u: Omit<Who, "guest">) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Sign-in failed.");
    onUser(j.user);
  };
  const field = "h-11 w-full rounded-lg border border-input bg-background/60 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <div aria-hidden className="brick-bg" />
      <main className="relative z-10 flex w-full max-w-sm flex-col gap-5 rounded-xl border bg-background/92 p-6 shadow-2xl">
        <Mascot state="idle" size={84} className="-ml-2" />
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">FixIt</h1>
          <p className="mt-2 text-sm text-muted-foreground">Home repairs, guided. Sign in to keep your history and send landlord requests from your own Gmail.</p>
        </div>
        <Button size="lg" autoFocus onClick={onGuest} className="h-14 gap-2 text-base font-semibold">
          Continue as guest <ArrowRight className="size-5" />
        </Button>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><span className="h-px flex-1 bg-border" />or sign in<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="flex flex-col gap-2">
          <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Your name" />
          <input className={field} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" variant="outline" disabled={busy} className="h-11 gap-2"><Mail className="size-4" />{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
      </main>
    </div>
  );
}
