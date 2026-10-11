"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, useReducedMotion } from "motion/react";
import { Activity, FileAudio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ApprovalCard } from "./approval-card";
import { Markdown } from "./markdown";
import { Composer } from "./composer";
import { TracePanel, type TraceTurn } from "./trace-panel";
import type { MMMessage } from "@/lib/trace";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Explain what a model router does in two sentences.",
  "Plan a 3-step refactor for a messy React component.",
  "Send an email to the judges with our demo link.",
];

export function Chat() {
  const reduce = useReducedMotion();
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const { messages, sendMessage, status, stop, error } = useChat<MMMessage>({
    id: "mmhack",
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages, reduce]);

  const turns: TraceTurn[] = useMemo(() => {
    const out: TraceTurn[] = [];
    messages.forEach((m, i) => {
      if (m.role !== "assistant") return;
      const prev = messages[i - 1];
      const prompt = prev?.parts.map((p) => (p.type === "text" ? p.text : p.type === "file" ? `[${p.mediaType}]` : "")).join(" ") ?? "";
      const d = decisions[m.id];
      const steps = m.parts.flatMap((p) =>
        p.type !== "data-trace" ? [] : p.data.status === "awaiting_approval" && d ? [{ ...p.data, status: d === "approved" ? ("done" as const) : ("skipped" as const), why: d === "approved" ? "Approved by a human." : "Rejected by a human. Nothing ran." }] : [p.data],
      );
      if (steps.length) out.push({ turn: out.length + 1, prompt, steps });
    });
    return out;
  }, [messages, decisions]);

  const trace = <TracePanel turns={turns} />;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <span className="font-display text-sm font-bold uppercase tracking-[0.2em]">
          mm<span className="text-mm-accent">hack</span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">one chat, many models, every decision visible</span>
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="sm" className="ml-auto lg:hidden" />}>
            <Activity /> Trace
          </SheetTrigger>
          <SheetContent side="right" className="w-[90vw] p-0 sm:max-w-md">
            <SheetTitle className="sr-only">Routing trace</SheetTitle>
            {trace}
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
              {messages.length === 0 && (
                <div className="flex flex-col gap-6 pt-[12vh]">
                  <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-6xl">
                    Right model.<br /><span className="text-mm-accent">Every time.</span>
                  </h1>
                  <p className="max-w-md text-muted-foreground">Each message is routed to the cheapest model that can handle it. The trace shows why.</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {SUGGESTIONS.map((s) => (
                      <Button key={s} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => sendMessage({ text: s })}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className={cn("flex flex-col gap-2", m.role === "user" && "items-end")}
                >
                  {m.parts.map((p, i) => {
                    if (p.type === "text" && m.role === "assistant")
                      return <div key={i} className="max-w-[85%]"><Markdown>{p.text}</Markdown></div>;
                    if (p.type === "text")
                      return (
                        <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap text-[15px] leading-relaxed", m.role === "user" ? "rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5" : "")}>
                          {p.text}
                        </div>
                      );
                    if (p.type === "file")
                      return p.mediaType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={p.url} alt={p.filename ?? "attachment"} className="max-h-48 rounded-lg border" />
                      ) : (
                        <span key={i} className="flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs"><FileAudio className="size-3.5" />{p.filename ?? p.mediaType}</span>
                      );
                    if (p.type === "data-approval")
                      return (
                        <ApprovalCard
                          key={i}
                          request={p.data}
                          decided={decisions[m.id]}
                          onDecide={(d) => {
                            setDecisions((x) => ({ ...x, [m.id]: d }));
                            if (d === "approved") sendMessage({ text: p.data.prompt }, { body: { approved: true } });
                          }}
                        />
                      );
                    return null;
                  })}
                  {m.role === "assistant" && busy && m.id === messages.at(-1)?.id && !m.parts.some((p) => p.type === "text") && !m.parts.some((p) => p.type === "data-approval") && (
                    <span className="h-4 w-16 animate-pulse rounded bg-muted" />
                  )}
                </motion.div>
              ))}
              {status === "submitted" && messages.at(-1)?.role === "user" && <span className="h-4 w-16 animate-pulse rounded bg-muted" />}
              {error && <p className="text-sm text-destructive">Something failed: {error.message}</p>}
              <div ref={endRef} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-2xl px-4 pb-4">
            <Composer busy={busy} onStop={stop} onSend={(text, files) => sendMessage({ text, files })} />
          </div>
        </main>
        <div className="hidden w-[380px] shrink-0 border-l bg-sidebar lg:block">{trace}</div>
      </div>
    </div>
  );
}
