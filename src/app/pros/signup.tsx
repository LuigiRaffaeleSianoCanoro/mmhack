"use client";
import { useState } from "react";
import { TRADES } from "@/lib/pros/shared";

const field = "h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:border-mm-accent";
export function ProSignup() {
  const [state, setState] = useState<{ busy?: boolean; err?: string; done?: { name: string; trade: string; zip: string } }>({});
  if (state.done)
    return (
      <div role="status" className="rounded-xl border border-mm-accent bg-card p-5">
        <h2 className="font-display text-xl font-bold uppercase">You&apos;re in, {state.done.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">We saved your {state.done.trade} profile for ZIP {state.done.zip}. When a FixIt user near you needs {state.done.trade} help and approves a message, it comes to you with a brief. No charge until a visit is booked.</p>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState({ busy: true });
        const body = Object.fromEntries(new FormData(e.currentTarget));
        const r = await fetch("/api/pros", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
        const j = r ? await r.json().catch(() => ({})) : { error: "Network error." };
        setState(r?.ok ? { done: j.pro } : { err: j.error ?? "Could not save." });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">Name or business<input name="name" required className={field} /></label>
      <label className="flex flex-col gap-1 text-sm">Trade<select name="trade" required className={field} defaultValue="">{<option value="" disabled>Choose…</option>}{TRADES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <label className="flex flex-col gap-1 text-sm">ZIP<input name="zip" required inputMode="numeric" pattern="[0-9]{5}" className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Service area<input name="area" placeholder="e.g. Beverly Hills, Westwood" className={field} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">Phone<input name="phone" type="tel" required className={field} /></label>
        <label className="flex flex-col gap-1 text-sm">Email<input name="email" type="email" required className={field} /></label>
      </div>
      <label className="flex flex-col gap-1 text-sm">Rate notes<textarea name="rateNotes" rows={3} placeholder="e.g. $95 service call, waived if you book the repair" className="w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:border-mm-accent" /></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state.err && <p role="alert" className="text-sm text-destructive">{state.err}</p>}
      <button disabled={state.busy} className="h-10 rounded-md bg-mm-accent font-semibold text-black disabled:opacity-60">{state.busy ? "Saving…" : "Create free profile"}</button>
    </form>
  );
}
