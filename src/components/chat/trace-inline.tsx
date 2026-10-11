"use client";
import { useState } from "react";
import { ChevronDown, Clock, Coins, Info, Plug, TriangleAlert, Loader2, UserRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TraceStep } from "@/lib/trace";
import { whyLink } from "@/lib/adr";
import { costShort, costText, modelName, runsOn, secs, stepLine, stepName, whyModel } from "@/lib/humanize";
import { cn } from "@/lib/utils";

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

export function TraceInline({ steps: all, sent }: { steps: TraceStep[]; sent?: { to?: string; at?: number } }) {
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState(false);
  const [tapped, setTapped] = useState<string | null>(null);
  // FixIt memory: profile use is shown as its own chip, not as a model step.
  const prof = all.find((s) => s.id === "profile");
  const steps = all.filter((s) => s.id !== "profile");
  if (!steps.length && !prof) return null;
  const latency = steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0);
  const cost = steps.reduce((a, s) => a + (s.costUsd ?? 0), 0);
  const failed = steps.filter((s) => s.status === "error" && s.id !== "outbound");
  const whys = [...new Set(steps.map(whyModel).filter(Boolean))];
  const details: Record<string, string> = {
    latency: `Took ${secs(latency)}`,
    cost: costText(cost, steps.some((s) => s.costUnknown)),
    ...(runsOn(steps) ? { via: runsOn(steps) } : {}),
    ...(whys.length ? { why: whys.join("\n") } : {}),
  };
  return (
    <div className="ribbed-glass-h w-full max-w-[85%] rounded-lg border border-border bg-card/90 px-3 py-2 text-xs">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-2 text-left text-muted-foreground">
        <span className="flex flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
          {steps.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="opacity-50">·</span>}
              {s.status === "running" && <Loader2 className="size-3 animate-spin text-mm-accent" />}
              <span className={cn(s.status === "error" && s.id !== "outbound" && "line-through opacity-60", s.status === "skipped" && "opacity-50")}>
                {s.id === "outbound" && sent ? "Sent" : stepName(s)}
              </span>
            </span>
          ))}
        </span>
        <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {prof && (
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} className="mt-1.5 mr-1 inline-flex items-center gap-1 rounded-full border border-mm-accent/40 bg-mm-accent-soft px-2 py-0.5 text-[11px] text-foreground" />}>
            <UserRound className="size-3 text-mm-accent" /> {prof.why.split(". ")[0]}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{prof.why}</TooltipContent>
        </Tooltip>
      )}
      {failed.map((s) => (
        <p key={s.id} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
          <TriangleAlert className="size-3" /> {stepLine(s)}
        </p>
      ))}
      {open && (
        <div className="mt-2 border-t border-border pt-2">
          <ul className="space-y-1.5">
            {steps.map((s) => (
              <li key={s.id}>
                <p className="text-foreground/90">{stepLine(s, s.id === "outbound" ? sent : undefined)}</p>
                {(modelName(s.model) || whyModel(s)) && s.status !== "skipped" && (
                  <p className="text-[11px] text-muted-foreground">
                    {modelName(s.model) && <>by {modelName(s.model)}{s.latencyMs != null ? ` · ${secs(s.latencyMs)}` : ""}. </>}
                    {WHY_SHORT(s)}
                    {whyLink(s.id) && <> <a href={whyLink(s.id)!.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">Why this model?</a></>}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setTech((t) => !t)} aria-expanded={tech} className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("size-3 transition-transform", tech && "rotate-180")} /> Technical details
          </button>
          {tech && (
            <ul className="mt-1 space-y-1 font-mono text-[10px] text-muted-foreground">
              {steps.map((s) => (
                <li key={s.id} className="break-words">{s.id} · {s.model} via {s.provider} · {s.status}{s.latencyMs != null ? ` · ${s.latencyMs}ms` : ""}{s.tokens ? ` · ${s.tokens.input}→${s.tokens.output} tok` : ""}{s.costUsd != null ? ` · $${s.costUsd.toFixed(4)}` : s.costUnknown ? " · cost unknown" : ""} · {s.why}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-0.5">
        <Icon label="Time" icon={<Clock className="size-3.5" />} detail={details.latency} onTap={() => setTapped(tapped === "latency" ? null : "latency")} />
        <Icon label="Cost" icon={<Coins className="size-3.5" />} detail={details.cost} onTap={() => setTapped(tapped === "cost" ? null : "cost")} />
        {details.via && <Icon label="Models" icon={<Plug className="size-3.5" />} detail={details.via} onTap={() => setTapped(tapped === "via" ? null : "via")} />}
        {details.why && <Icon label="Why these models" icon={<Info className="size-3.5" />} detail={details.why} onTap={() => setTapped(tapped === "why" ? null : "why")} />}
        <span className="ml-auto text-[10px] text-muted-foreground">{latency ? `${(latency / 1000).toFixed(1)}s` : ""}{costShort(cost) ? ` · ${costShort(cost)}` : ""}</span>
      </div>
      {tapped && details[tapped] && <p className="mt-1 whitespace-pre-line text-[11px] text-muted-foreground sm:hidden">{details[tapped]}</p>}
    </div>
  );
}

const WHY_SHORT = (s: TraceStep) => whyModel(s).replace(/^Why [^:]+:\s*/, "").replace(/^./, (c) => c.toUpperCase());
