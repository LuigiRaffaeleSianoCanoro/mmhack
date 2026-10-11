"use client";
import { useState } from "react";
import { CheckCircle2, Mail, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect } from "react";
import { useAuth } from "@/components/fixit/auth";
import { sentLine } from "@/lib/humanize";

type Result = { ok: boolean; to?: string; id?: string; at?: number; error?: string; duplicate?: boolean };
const RKEY = (uid: string) => `fixit.sent.${uid}`;
const loadSent = (uid: string): Record<string, Result> => { try { return JSON.parse(localStorage.getItem(RKEY(uid)) ?? "{}"); } catch { return {}; } };

/** The Gmail send result for one message, kept in sync across the card and the trace panel. */
export function useSent(sendKey: string, uid: string) {
  const [r, setR] = useState<Result | undefined>(undefined);
  useEffect(() => {
    const read = () => setR(loadSent(uid)[sendKey]);
    read();
    window.addEventListener("fixit:sent", read);
    return () => window.removeEventListener("fixit:sent", read);
  }, [sendKey, uid]);
  return r?.ok ? r : undefined;
}

// Preview + send of the approved landlord draft. One send per approval (keyed by message id).
export function EmailCard({ sendKey, subject: initialSubject, draft, defaultTo }: { sendKey: string; subject: string; draft: string; defaultTo?: string }) {
  const auth = useAuth();
  const uid = auth?.who.id ?? "guest";
  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(draft.trim());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | undefined>(() => (typeof window === "undefined" ? undefined : loadSent(uid)[sendKey]));
  if (!auth) return null;
  const { who, gmail } = auth;
  const box = "rounded-lg border border-mm-accent/40 bg-card/90 p-3 text-sm max-w-md flex flex-col gap-2";

  if (who.guest)
    return <div className={box}><p className="text-muted-foreground"><Mail className="mr-1 inline size-4" />Guest preview: copy this draft to your landlord. Sign in and connect Gmail to send it from your own address.</p></div>;
  if (result?.ok)
    return (
      <div role="status" className={box}>
        <p className="flex items-center gap-2 font-medium text-emerald-400"><CheckCircle2 className="size-4 shrink-0" />{sentLine(result)}</p>
        {result.duplicate && <p className="text-xs text-muted-foreground">It was already sent, so we didn&apos;t send it again.</p>}
      </div>
    );
  if (!gmail.enabled) return <div className={box}><p className="text-muted-foreground">Gmail sending isn&apos;t configured on this deployment. Copy the draft above.</p></div>;
  if (!gmail.connected)
    return (
      <div className={box}>
        <p>Send this from your own Gmail. FixIt never sees your password.</p>
        <Button size="sm" className="gap-2 self-start" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await fetch("/api/gmail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "connect" }) });
          const j = await r.json();
          setBusy(false);
          if (j.redirectUrl) window.location.href = j.redirectUrl;
          else setResult({ ok: false, error: j.error ?? "Could not start Gmail connect." });
        }}><Mail className="size-4" />Connect Gmail</Button>
        {result?.error && <p className="text-destructive">{result.error}</p>}
      </div>
    );
  const send = async () => {
    setBusy(true);
    const r = await fetch("/api/gmail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send", key: sendKey, to, subject, body }) });
    const j: Result = await r.json().catch(() => ({ ok: false, error: "Bad response" }));
    setBusy(false);
    const res = r.ok ? { ...j, ok: true } : { ok: false, error: j.error ?? `HTTP ${r.status}` };
    setResult(res);
    if (res.ok) { const all = loadSent(uid); all[sendKey] = res; localStorage.setItem(RKEY(uid), JSON.stringify(all)); window.dispatchEvent(new Event("fixit:sent")); }
  };
  const field = "h-9 w-full rounded-md border border-input bg-background/60 px-2.5 outline-none focus-visible:border-ring";
  return (
    <form className={box} onSubmit={(e) => { e.preventDefault(); if (!busy) send(); }}>
      <p className="font-display text-xs uppercase tracking-[0.12em] text-mm-accent">Check it, then send from your Gmail</p>
      {defaultTo && to === defaultTo && <p className="text-[11px] text-muted-foreground">Recipient from your FixIt profile. Check it before sending.</p>}
      <input className={field} type="email" required placeholder="Landlord email" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Landlord email" />
      <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="field-sizing-fixed min-h-40 max-h-72 w-full min-w-0 resize-y whitespace-pre-wrap break-words font-sans text-sm" aria-label="Email body" />
      {result?.error && <p role="alert" className="flex items-center gap-1.5 text-destructive"><TriangleAlert className="size-4" />{result.error}</p>}
      <Button type="submit" size="sm" disabled={busy || !to} className="gap-2 self-start"><Mail className="size-4" />{busy ? "Sending…" : "Send from my Gmail"}</Button>
    </form>
  );
}
