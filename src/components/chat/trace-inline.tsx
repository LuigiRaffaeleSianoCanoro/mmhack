"use client";
import { useState } from "react";
import { ChevronDown, Clock, Coins, Info, Plug, TriangleAlert, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TraceStep } from "@/lib/trace";
import { whyLink } from "@/lib/adr";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = { illustrate: "Illustration", gate: "Gate", outbound: "Outbound", triage: "Triaged", vision: "Photo", confirm: "Confirmed", understand: "Understood", plan: "Plan", "plan-fallback": "Fallback", check: "Checked", followup: "Answered", safety: "Safety", ask: "Asked" };
const short = (m: string) => m.replace("claude-sonnet-5-5", "Sonnet");
const fmtMs = (ms?: number) => (ms == null ? "…" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
const fmtUsd = (c?: number) => (c == null ? "n/a" : c < 0.001 ? "<$0.001" : `$${c.toFixed(3)}`);

function Icon({ label, icon, detail, onTap }: { label: string; icon: React.ReactNode; detail: string; onTap: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" aria-label={`${label}: ${detail}`} onClick={onTap} className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-mm-accent" />}
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs whitespace-pre-line">{detail}</TooltipContent>
    </Tooltip>
  );
}

export function TraceInline({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState(false);
  const [tapped, setTapped] = useState<string | null>(null);
  if (!steps.length) return null;
  const latency = steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0);
  const cost = steps.reduce((a, s) => a + (s.costUsd ?? 0), 0);
  const failed = steps.filter((s) => s.status === "error");
  const details = {
    latency: steps.map((s) => `${LABEL[s.id] ?? s.task}: ${fmtMs(s.latencyMs)}`).join("\n"),
    cost: steps.map((s) => `${short(s.model)}: ${s.costUnknown ? "unknown" : fmtUsd(s.costUsd)}${s.tokens ? ` (${s.tokens.input}→${s.tokens.output} tok)` : ""}`).join("\n"),
    via: steps.map((s) => `${short(s.model)} via ${s.provider}`).join("\n"),
    why: steps.map((s) => `${LABEL[s.id] ?? s.task}: ${s.why}`).join("\n"),
  };
  return (
    <div className="ribbed-glass-h w-full max-w-[85%] rounded-lg border border-border bg-card/90 px-3 py-2 text-xs">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-2 text-left text-muted-foreground">
        <span className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
          {steps.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="opacity-50">·</span>}
              {s.status === "running" && <Loader2 className="size-3 animate-spin text-mm-accent" />}
              <span className={cn(s.status === "error" && "line-through opacity-60", s.status === "skipped" && "opacity-50")}>
                {LABEL[s.id] ?? s.task} by <span className="text-foreground">{short(s.model)}</span>
              </span>
            </span>
          ))}
        </span>
        <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {failed.map((s) => (
        <Tooltip key={s.id}>
          <TooltipTrigger render={<button type="button" onClick={() => setTapped(tapped === s.id ? null : s.id)} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200" />}>
            <TriangleAlert className="size-3" /> {short(s.model)} failed{steps.some((x) => x.id === "plan-fallback") && s.id === "plan" ? " → fallback gpt-5" : ""}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{s.why}</TooltipContent>
        </Tooltip>
      ))}
      {tapped && failed.find((s) => s.id === tapped) && <p className="mt-1 text-[11px] text-amber-200/90">{failed.find((s) => s.id === tapped)!.why}</p>}
      {open && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {steps.map((s) => (
            <li key={s.id} className="flex gap-2"><span className="w-20 shrink-0 text-muted-foreground">{LABEL[s.id] ?? s.task}</span><span className="text-foreground/90">{s.why}{whyLink(s.id) && (<> <a href={whyLink(s.id)!.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-muted-foreground hover:text-foreground">Why this model? ({whyLink(s.id)!.adr})</a></>)}</span></li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex items-center gap-0.5">
        <Icon label="Latency" icon={<Clock className="size-3.5" />} detail={details.latency} onTap={() => setTapped(tapped === "latency" ? null : "latency")} />
        <Icon label="Cost" icon={<Coins className="size-3.5" />} detail={details.cost} onTap={() => setTapped(tapped === "cost" ? null : "cost")} />
        <Icon label="Provider" icon={<Plug className="size-3.5" />} detail={details.via} onTap={() => setTapped(tapped === "via" ? null : "via")} />
        <Icon label="Why these models" icon={<Info className="size-3.5" />} detail={details.why} onTap={() => setTapped(tapped === "why" ? null : "why")} />
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{fmtMs(latency)} · {fmtUsd(cost)}</span>
      </div>
      {tapped && tapped in details && <p className="mt-1 whitespace-pre-line font-mono text-[10px] text-muted-foreground sm:hidden">{details[tapped as keyof typeof details]}</p>}
    </div>
  );
}
