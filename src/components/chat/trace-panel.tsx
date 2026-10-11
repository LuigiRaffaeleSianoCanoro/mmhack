"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleDashed, Hand, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TraceStep } from "@/lib/trace";
import { cn } from "@/lib/utils";

export type TraceTurn = { turn: number; prompt: string; steps: TraceStep[] };

const icon = {
  running: <Loader2 className="size-3.5 animate-spin text-mm-accent" />,
  done: <Check className="size-3.5 text-mm-ok" />,
  error: <X className="size-3.5 text-destructive" />,
  awaiting_approval: <Hand className="size-3.5 text-mm-warn" />,
  skipped: <CircleDashed className="size-3.5 text-muted-foreground" />,
};

function fmtCost(c?: number) {
  if (c === undefined) return "…";
  if (c === 0) return "$0";
  return c < 0.0001 ? `<$0.0001` : `$${c.toFixed(4)}`;
}

export function TracePanel({ turns, className }: { turns: TraceTurn[]; className?: string }) {
  const reduce = useReducedMotion();
  const total = turns.flatMap((t) => t.steps).reduce((a, s) => a + (s.costUsd ?? 0), 0);
  return (
    <aside className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-baseline justify-between border-b px-4 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.16em]">Routing trace</h2>
        <span className="font-mono text-xs text-muted-foreground">session {fmtCost(total)}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          {turns.length === 0 && (
            <p className="text-sm text-muted-foreground">Every message gets routed. Each step shows the task, the model chosen, why, latency, and cost.</p>
          )}
          {turns.map((t) => (
            <section key={t.turn} className="space-y-2">
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-mono text-mm-accent">{String(t.turn).padStart(2, "0")}</span> {t.prompt}
              </p>
              <ol className="space-y-2">
                <AnimatePresence initial={false}>
                  {t.steps.map((s) => (
                    <motion.li
                      key={s.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      className={cn("rounded-lg border bg-card p-3", s.status === "running" && "border-mm-accent/40")}
                    >
                      <div className="flex items-center gap-2">
                        {icon[s.status]}
                        <span className="text-sm font-medium">{s.task}</span>
                        <Badge variant="secondary" className="ml-auto font-mono text-[11px]">{s.model}</Badge>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.why}</p>
                      <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground">
                        <div><dt className="opacity-60">latency</dt><dd className="text-foreground">{s.latencyMs !== undefined ? `${s.latencyMs}ms` : "…"}</dd></div>
                        <div><dt className="opacity-60">cost</dt><dd className="text-foreground">{fmtCost(s.costUsd)}</dd></div>
                        <div><dt className="opacity-60">via</dt><dd className="truncate text-foreground">{s.provider}</dd></div>
                      </dl>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ol>
            </section>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
