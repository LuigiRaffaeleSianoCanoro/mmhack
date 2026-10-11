"use client";
import { useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DeliveryReady } from "@/lib/trace";

type Rec = { state: "pending" | "delivered" | "unknown" | "export_only" | "rejected"; receipt?: { base44Id: string; url?: string }; error?: string; draftHash: string };

const label: Record<Rec["state"], string> = {
  pending: "Pending: waiting for the Base44 receipt…",
  delivered: "Delivered to the Landlord Inbox",
  unknown: "Delivery unknown. It will reconcile with Base44 before any retry.",
  export_only: "Not sent. Saved locally (export only).",
  rejected: "Rejected. Nothing was sent.",
};

/** Second approval: send the drafted landlord request to the Base44 Landlord Inbox, once. */
export function DeliverCard({ ready, draftText }: { ready: DeliveryReady; draftText: string }) {
  const [body, setBody] = useState(draftText);
  const [rec, setRec] = useState<Rec>();
  const [sentBody, setSentBody] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const draft = { title: ready.title, urgency: ready.urgency, category: ready.category, body, planSummary: ready.summary };
  const edited = rec && rec.state !== "rejected" && sentBody !== undefined && body !== sentBody;

  async function decide(decision: "approved" | "rejected") {
    if (busy) return;
    setBusy(true);
    setErr(undefined);
    try {
      const { draftHash } = await (await fetch("/api/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft, hashOnly: true }) })).json();
      const r = await fetch("/api/inbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft, draftHash, decision }) });
      const j = await r.json();
      if (j.record) { setRec(j.record); setSentBody(draft.body); }
      else setErr(j.error ?? `HTTP ${r.status}`);
    } catch (e) {
      setErr(`${(e as Error).message}. Status unknown; retrying will reconcile first.`);
    } finally {
      setBusy(false);
    }
  }

  const exportTxt = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`${draft.title}\nUrgency: ${draft.urgency}\n\n${body}\n`], { type: "text/plain" }));
    a.download = "landlord-request.txt";
    a.click();
  };

  const final = rec && ["delivered", "rejected", "export_only"].includes(rec.state) && !edited;
  return (
    <div className="max-w-md space-y-2 rounded-lg border bg-card p-3">
      <p className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.12em]"><Inbox className="size-4 text-mm-accent" /> Send to Landlord Inbox</p>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={busy || !!final} className="min-h-32 text-xs" aria-label="Landlord request draft" />
      <p className="font-mono text-[11px] text-muted-foreground">urgency {ready.urgency} · {ready.category}{edited ? " · edited: approve again" : ""}</p>
      {rec && !edited && (
        <p className="text-xs">
          {label[rec.state]}
          {rec.receipt && <> · receipt <span className="font-mono">{rec.receipt.base44Id}</span>{rec.receipt.url && <> · <a className="underline" href={rec.receipt.url} target="_blank" rel="noreferrer">open</a></>}</>}
          {rec.error && rec.state !== "delivered" && <span className="block text-muted-foreground">{rec.error}</span>}
        </p>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        {!final && (
          <>
            <Button size="sm" disabled={busy} onClick={() => decide("approved")}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : null}Approve & send</Button>
            {rec?.state !== "unknown" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("rejected")}>Reject</Button>}
          </>
        )}
        {rec?.state === "export_only" && <Button size="sm" variant="outline" onClick={exportTxt}>Download .txt</Button>}
      </div>
    </div>
  );
}
