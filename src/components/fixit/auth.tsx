"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/fixit/mascot";

export type Who = { id: string; name: string; email: string; guest: boolean };
type Gmail = { enabled: boolean; connected: boolean; email?: string };
type Ctx = { who: Who; gmail: Gmail; refreshGmail: () => Promise<void>; signOut: () => Promise<void>; signIn: () => void };
const AuthCtx = createContext<Ctx | null>(null);
export const useAuth = () => useContext(AuthCtx);
const GUEST_KEY = "fixit.guest";
export const CARRY_KEY = "fixit.carry";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [who, setWho] = useState<Who | null | undefined>(undefined);
  const [emailSignIn, setEmailSignIn] = useState(false);
  const [gmail, setGmail] = useState<Gmail>({ enabled: false, connected: false });
  const refreshGmail = useCallback(async () => {
    try { setGmail(await (await fetch("/api/gmail", { cache: "no-store" })).json()); } catch {}
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const { user, emailSignIn } = await (await fetch("/api/auth", { cache: "no-store" })).json();
        setEmailSignIn(!!emailSignIn);
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
  // AWS-68: guest -> sign-in without losing work. Remember the open chat; it is carried into the signed-in history.
  const signIn = () => {
    try { const cur = sessionStorage.getItem("fixit.current"); if (cur) localStorage.setItem(CARRY_KEY, cur); } catch {}
    setWho(null);
  };
  if (who === undefined) return <div className="h-dvh" />;
  if (who === null)
    return (
      <Login
        onGuest={() => { localStorage.setItem(GUEST_KEY, "1"); setWho({ id: "guest", name: "Guest", email: "", guest: true }); }}
        emailSignIn={emailSignIn}
      />
    );
  return <AuthCtx.Provider value={{ who, gmail, refreshGmail, signOut, signIn }}>{children}</AuthCtx.Provider>;
}

function Login({ onGuest, emailSignIn }: { onGuest: () => void; emailSignIn: boolean }) {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const request = async (addr: string) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: addr }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error ?? "Couldn't send the link.");
      setSentTo(addr); setWait(30);
    } catch { setErr("Network error. Try again."); } finally { setBusy(false); }
  };
  const submit = (e: React.FormEvent) => { e.preventDefault(); request(email.trim()); };
  const field = "h-11 w-full rounded-lg border border-input bg-background/60 px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <div aria-hidden className="brick-bg" />
      <main className="relative z-10 flex w-full max-w-sm flex-col gap-5 rounded-xl border bg-background/92 p-6 shadow-2xl">
        <Mascot state={sentTo ? "happy" : "idle"} size={208} className="mx-auto -mb-2 sm:my-4 sm:scale-[1.2]" />
        {sentTo ? (
          <div className="flex flex-col gap-4 text-center" aria-live="polite">
            <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">We sent a sign-in link to <span className="font-medium text-foreground">{sentTo}</span>. It works once and expires in 15 minutes.</p>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button variant="outline" disabled={busy || wait > 0} onClick={() => request(sentTo)} className="h-11">{wait > 0 ? `Resend in ${wait}s` : busy ? "Sending…" : "Resend link"}</Button>
            <button type="button" className="text-sm text-muted-foreground underline underline-offset-4" onClick={() => { setSentTo(""); setErr(""); }}>Use a different email</button>
            <Button size="lg" onClick={onGuest} className="h-12 gap-2 text-base font-semibold">Continue as guest <ArrowRight className="size-5" /></Button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">FixIt</h1>
              <p className="mt-2 text-sm text-muted-foreground">{emailSignIn ? "Home repairs, guided. Sign in to keep your history and send landlord requests from your own Gmail." : "Home repairs, guided."}</p>
            </div>
            <Button size="lg" autoFocus onClick={onGuest} className="h-14 gap-2 text-base font-semibold">
              Continue as guest <ArrowRight className="size-5" />
            </Button>
            {emailSignIn && (
              <>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><span className="h-px flex-1 bg-border" />or sign in with email<span className="h-px flex-1 bg-border" /></div>
                <form onSubmit={submit} className="flex flex-col gap-2">
                  <input className={field} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" />
                  {err && <p className="text-sm text-destructive">{err}</p>}
                  <Button type="submit" variant="outline" disabled={busy} className="h-11 gap-2"><Mail className="size-4" />{busy ? "Sending…" : "Email me a sign-in link"}</Button>
                </form>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
