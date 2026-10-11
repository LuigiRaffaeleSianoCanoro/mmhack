"use client";
import { useEffect, useState } from "react";
import { Copy, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { introMessage, type PublicPro, type Trade } from "@/lib/pros/shared";

/**
 * "Recommended pros near you". Shown when a plan says to call a professional, or after a safety stop.
 * Nothing is ever sent from here: Request visit requires an explicit approve step, and v0 then only prepares
 * a draft (demo pros have no contact details). No ratings or reviews are shown because we have none.
 */
export function ProsCard({ trade, zip, problem, hazard }: { trade: Trade; zip: string; problem: string; hazard?: boolean }) {
  const [pros, setPros] = useState<PublicPro[] | null>(null);
  useEffect(() => {
    fetch(`/api/pros?trade=${encodeURIComponent(trade)}&zip=${encodeURIComponent(zip)}`).then((r) => r.json()).then((j) => setPros(j.pros ?? [])).catch(() => setPros([]));
  }, [trade, zip]);
  if (!pros?.length) return null;
  return (
    <section aria-label="Recommended pros near you" className="flex max-w-md flex-col gap-3 rounded-xl border bg-card/90 p-4">
      <div>
        <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em]">Recommended pros near you</h3>
        <p className="text-xs text-muted-foreground">{trade} · {zip ? `near ${zip}` : "near 90210 (add your ZIP in your profile)"}{hazard ? " · after you're safe and the utility/911 has been called" : ""}</p>
      </div>
      {pros.map((p) => <ProRow key={p.id} pro={p} msg={introMessage(p, problem, zip)} />)}
    </section>
  );
}

function ProRow({ pro, msg }: { pro: PublicPro; msg: string }) {
  const [text, setText] = useState(msg);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"idle" | "confirm" | "drafted">("idle");
  return (
    <div className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{pro.name.replace(/\s*\(Demo pro\)$/, "")}</span>
        {pro.demo && <span className="rounded-full border border-amber-400/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">Demo pro</span>}
        <span className="text-xs text-muted-foreground">{pro.trade} · {pro.area || pro.zip}</span>
      </div>
      {pro.rateNotes && <p className="text-xs text-muted-foreground">{pro.rateNotes}</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-mm-accent">Intro message</summary>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className="mt-2 w-full rounded-md border bg-background p-2 text-sm" />
      </details>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} }}><Copy className="size-4" />{copied ? "Copied" : "Copy"}</Button>
        {step === "idle" && <Button size="sm" className="gap-2" onClick={() => setStep("confirm")}><CalendarCheck className="size-4" />Request visit</Button>}
      </div>
      {step === "confirm" && (
        <div role="dialog" aria-label="Approve visit request" className="flex flex-col gap-2 rounded-md border border-mm-accent/60 p-3 text-sm">
          <p>Approve this request to <b>{pro.name}</b>? Nothing is sent automatically.</p>
          <div className="flex gap-2"><Button size="sm" onClick={() => setStep("drafted")}>Approve</Button><Button size="sm" variant="ghost" onClick={() => setStep("idle")}>Cancel</Button></div>
        </div>
      )}
      {step === "drafted" && (
        <p role="status" className="text-xs text-emerald-400">Approved. Draft ready{pro.demo ? ": this is a demo pro, so nothing was sent. Copy the message to use it with a real pro." : ". Copy it to send; direct booking isn't live yet."}</p>
      )}
    </div>
  );
}
