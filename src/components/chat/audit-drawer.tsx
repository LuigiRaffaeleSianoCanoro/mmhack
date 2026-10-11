"use client";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Event = { at: string; actor: { type: string; id: string }; action: string; from?: string; to?: string; ok: boolean; details?: Record<string, unknown> };
type JobView = { id: string; state: string; draftHash: string; claimId?: string; store: string; storeLabel: string; audit: Event[] };

/** AWS-54: read-only audit trail for one FixIt job. */
export function AuditDrawer({ jobId, jobToken }: { jobId: string; jobToken?: string }) {
  const [job, setJob] = useState<JobView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    setErr(null);
    const r = await fetch(`/api/jobs/${jobId}`, { headers: jobToken ? { "x-job-token": jobToken } : undefined }).catch(() => null);
    if (!r) return setErr("Audit trail unavailable offline.");
    if (r.ok) setJob(await r.json());
    else setErr(r.status === 404 ? "Audit trail not available for this session (demo store resets between deploys)." : "Audit trail temporarily unavailable.");
  };
  return (
    <Sheet onOpenChange={(o) => o && load()}>
      <SheetTrigger render={<Button size="sm" variant="ghost" className="ml-auto" />}>
        <ScrollText /> Audit
      </SheetTrigger>
      <SheetContent side="right" className="w-[90vw] gap-0 p-0 sm:max-w-md">
        <div className="border-b p-4">
          <SheetTitle className="font-display text-sm uppercase tracking-[0.12em]">Job audit trail</SheetTitle>
          {job && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              state <b className="text-foreground">{job.state}</b> · draft {job.draftHash.slice(0, 12)} · <span className={job.store === "local-fallback" ? "text-amber-600" : "text-emerald-600"}>{job.storeLabel}</span>
            </p>
          )}
        </div>
        <ol className="flex flex-col gap-2 overflow-y-auto p-4">
          {err && <li className="text-sm text-destructive">{err}</li>}
          {job?.audit.map((e, i) => (
            <li key={i} className="rounded-md border p-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">{e.actor.type}</span>
                <span className={e.ok ? "" : "text-destructive"}>{e.action}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                {e.actor.id.slice(0, 18)}
                {e.from || e.to ? ` · ${e.from ?? "∅"} → ${e.to}` : ""}
                {e.details ? ` · ${JSON.stringify(e.details).slice(0, 160)}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
