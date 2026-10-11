"use client";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Event = { at: string; actor: { type: string; id: string }; action: string; from?: string; to?: string; ok: boolean; details?: Record<string, unknown> };
type JobView = { id: string; state: string; draftHash: string; claimId?: string; store: string; storeLabel: string; audit: Event[] };

const WHO: Record<string, string> = { HUMAN: "You", AGENT: "AI", CODE: "Safety rules", SYSTEM: "FixIt" };
const STATE: Record<string, string> = { intake: "Started", triage: "Checked", diagnosis: "Checked", awaiting_approval: "Waiting for your OK", approved: "Approved", action: "Sending", done: "Done", rejected: "Declined", failed: "Didn't go through" };
function plain(e: Event): string {
  const a = e.action.toLowerCase();
  if (a.includes("denied") || a.includes("blocked")) return a.includes("already claimed") ? "Blocked a second run, so nothing was sent twice." : "Blocked: it didn't match what you approved.";
  if (a.includes("created")) return "Request started.";
  if (a.includes("triage")) return "Figured out what kind of problem it is.";
  if (a.includes("hazard")) return "Checked for safety hazards.";
  if (a.includes("approval required")) return "Waited for your OK.";
  if (a.includes("draft edited")) return "The draft was edited, so it needed your OK again.";
  if (a.includes("human approved")) return "You approved the request.";
  if (a.includes("human rejected")) return "You declined the request.";
  if (a.includes("claim released")) return "Didn't go through, so it was unlocked to retry safely.";
  if (a.includes("execution claimed")) return "Locked so it can only run once.";
  if (a.includes("action finished")) return "Finished.";
  if (a.includes("outbound") || a.includes("send") || a.includes("export")) return e.ok ? "Delivery step finished." : "Delivery didn't go through. Nothing was sent.";
  if (e.to) return `${STATE[e.to] ?? "Updated"}.`;
  return e.ok ? "Step recorded." : "A step didn't go through.";
}

/** AWS-54: read-only audit trail for one FixIt job. */
export function AuditDrawer({ jobId, jobToken }: { jobId: string; jobToken?: string }) {
  const [job, setJob] = useState<JobView | null>(null);
  const [tech, setTech] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    setErr(null);
    const r = await fetch(`/api/jobs/${jobId}`, { headers: jobToken ? { "x-job-token": jobToken } : undefined }).catch(() => null);
    if (!r) return setErr("History is unavailable offline.");
    if (r.ok) setJob(await r.json());
    else setErr(r.status === 404 ? "History isn't available for this request anymore." : "History is temporarily unavailable.");
  };
  return (
    <Sheet onOpenChange={(o) => o && load()}>
      <SheetTrigger render={<Button size="sm" variant="ghost" className="ml-auto" />}>
        <ScrollText /> History
      </SheetTrigger>
      <SheetContent side="right" className="w-[90vw] gap-0 p-0 sm:max-w-md">
        <div className="border-b p-4">
          <SheetTitle className="font-display text-sm uppercase tracking-[0.12em]">What happened</SheetTitle>
          {job && <p className="mt-1 text-xs text-muted-foreground">Status: <b className="text-foreground">{STATE[job.state] ?? job.state}</b>. Each step is recorded, and an approved request can&apos;t be changed or sent twice.</p>}
        </div>
        <ol className="flex flex-col gap-2 overflow-y-auto p-4">
          {err && <li className="text-sm text-destructive">{err}</li>}
          {job?.audit.map((e, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md border p-2 text-xs">
              <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px]">{WHO[e.actor.type.toUpperCase()] ?? "FixIt"}</span>
              <span className={e.ok ? "" : "text-destructive"}>{plain(e)}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
            </li>
          ))}
          {job && (
            <li>
              <button type="button" onClick={() => setTech((t) => !t)} aria-expanded={tech} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <ChevronDown className={tech ? "size-3 rotate-180" : "size-3"} /> Technical details
              </button>
              {tech && (
                <div className="mt-1 space-y-1 break-words font-mono text-[10px] text-muted-foreground">
                  <p>job {job.id} · state {job.state} · draft {job.draftHash.slice(0, 12)}{job.claimId ? ` · claim ${job.claimId.slice(0, 8)}` : ""} · {job.storeLabel}</p>
                  {job.audit.map((e, i) => <p key={i}>{e.actor.type}:{e.actor.id.slice(0, 18)} · {e.action}{e.from || e.to ? ` · ${e.from ?? "∅"}→${e.to}` : ""}{e.details ? ` · ${JSON.stringify(e.details).slice(0, 160)}` : ""}</p>)}
                </div>
              )}
            </li>
          )}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
