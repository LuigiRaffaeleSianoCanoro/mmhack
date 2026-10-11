"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, useReducedMotion } from "motion/react";
import { Mascot, type MascotState } from "@/components/fixit/mascot";
import Link from "next/link";
import { FileAudio } from "lucide-react";
import { getAssistant } from "@/lib/assistants";
import { Button } from "@/components/ui/button";
import { ApprovalCard } from "./approval-card";
import { IllustrationCard } from "./illustration-card";
import { EmailCard } from "./email-card";
import { Markdown } from "./markdown";
import { Composer } from "./composer";
import { TraceInline } from "./trace-inline";
import type { TraceStep } from "@/lib/trace";

const DETAILS = "<!--details-->";
import type { MMMessage } from "@/lib/trace";
import { cn } from "@/lib/utils";

export function Chat({ slug, sessionId, initialMessages, onMessages, headerLeft }: { slug: string; sessionId?: string; initialMessages?: MMMessage[]; onMessages?: (m: MMMessage[]) => void; headerLeft?: React.ReactNode }) {
  const assistant = getAssistant(slug)!;
  const reduce = useReducedMotion();
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const [illus, setIllus] = useState<Record<string, TraceStep>>({});
  // Latest server-signed job snapshots (AWS-54), so audit state survives serverless instance changes.
  const [jobTokens, setJobTokens] = useState<Record<string, string>>({});
  const { messages, sendMessage, status, stop, error } = useChat<MMMessage>({
    id: sessionId ?? `mmhack-${slug}`,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: assistant.api ?? "/api/chat", body: { assistant: slug } }),
  });
  const busy = status === "submitted" || status === "streaming";
  const mascotStateOf = (m: MMMessage): MascotState => {
    const last = m.id === messages.at(-1)?.id;
    if (m.parts.some((p) => p.type === "data-approval") && !decisions[m.id]) return "alert";
    if (last && busy) return "thinking";
    if (last && m.parts.some((p) => p.type === "text")) return "happy";
    return "idle";
  };
  const tokenOf = (jobId: string, fallback?: string) => {
    for (const m of [...messages].reverse()) for (const p of m.parts) if (p.type === "data-job" && p.data.jobId === jobId && p.data.jobToken) return p.data.jobToken;
    return jobTokens[jobId] ?? fallback;
  };
  useEffect(() => {
    if (!busy && messages.length) onMessages?.(messages);
  }, [busy, messages, onMessages]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages, reduce]);

  const stepsOf = (m: MMMessage): TraceStep[] => {
    const d = decisions[m.id];
    const steps = m.parts.flatMap((p) =>
      p.type !== "data-trace" ? [] : p.data.status === "awaiting_approval" && d ? [{ ...p.data, status: d === "approved" ? ("done" as const) : ("skipped" as const), why: d === "approved" ? "Approved by a human." : "Rejected by a human. Nothing ran." }] : [p.data],
    );
    return illus[m.id] ? [...steps, illus[m.id]] : steps;
  };
  const sessionCost = messages.reduce((a, m) => a + stepsOf(m).reduce((b, s) => b + (s.costUsd ?? 0), 0), 0);

  return (
    <div className="flex h-dvh flex-col">
      {slug === "fixit" && <div aria-hidden className="brick-bg" />}
      <header className="ribbed-glass relative z-30 flex h-12 shrink-0 items-center gap-3 border-b px-4">
        {headerLeft}
        <Link href="/" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground" aria-label="FixIt home">
          <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground">
            mm<span className="text-mm-accent">hack</span>
          </span>
        </Link>
        <span className="cloth hidden h-6 items-center rounded-[2px] px-3 font-mono text-[10px] uppercase tracking-[0.16em] sm:flex" style={{ backgroundColor: assistant.spine, color: assistant.ink }}>
          {assistant.title}
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground" title="Session model cost (estimate)">session ${sessionCost.toFixed(3)}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-5 bg-background/88 px-4 py-6 shadow-[0_0_60px_30px_oklch(0.125_0.005_300/0.6)]">
              {messages.length === 0 && (
                <div className="flex flex-col gap-6 pt-[8vh]">
                  <Mascot state="idle" size={112} className="-ml-3" />
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mm-accent">{assistant.activity} / by {assistant.author}</p>
                  <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-6xl">{assistant.title}</h1>
                  <p className="max-w-md font-serif text-lg italic text-muted-foreground">{assistant.blurb}</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {assistant.sampleImage && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-auto justify-start gap-2 py-1.5 text-left"
                        onClick={async () => {
                          const blob = await (await fetch(assistant.sampleImage!)).blob();
                          const dt = new DataTransfer();
                          dt.items.add(new File([blob], "faucet.jpg", { type: blob.type || "image/jpeg" }));
                          sendMessage({ text: "This is leaking. What do I do?", files: dt.files });
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={assistant.sampleImage} alt="" className="size-8 rounded object-cover" />
                        Try the sample photo
                      </Button>
                    )}
                    {assistant.starters.map((s) => (
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
                  className={cn("flex gap-3", m.role === "user" && "justify-end")}
                >
                  {m.role === "assistant" && <Mascot state={mascotStateOf(m)} size={36} className="mt-0.5" />}
                  <div className={cn("flex min-w-0 flex-1 flex-col gap-2", m.role === "user" && "items-end")}>
                  {m.parts.map((p, i) => {
                    if (p.type === "text" && m.role === "assistant")
                      {
                      const [head, more] = p.text.split(DETAILS);
                      return (
                        <div key={i} className="max-w-[85%]">
                          <Markdown>{head}</Markdown>
                          {more?.trim() && (
                            <details className="mt-2 rounded-md border border-border bg-card/80 px-3 py-2 text-sm">
                              <summary className="cursor-pointer text-mm-accent">Show details</summary>
                              <div className="mt-2"><Markdown>{more}</Markdown></div>
                            </details>
                          )}
                        </div>
                      );
                    }
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
                    if (p.type === "data-illustration")
                      return <IllustrationCard key={i} request={p.data} onTrace={(st) => setIllus((x) => ({ ...x, [m.id]: st }))} />;
                    if (p.type === "data-approval")
                      return (
                        <ApprovalCard
                          key={i}
                          request={p.data}
                          decided={decisions[m.id]}
                          jobToken={p.data.jobId ? tokenOf(p.data.jobId, p.data.jobToken) : undefined}
                          onDecide={async (d) => {
                            setDecisions((x) => ({ ...x, [m.id]: d }));
                            const { jobId, draftHash } = p.data;
                            let jobToken = jobId ? tokenOf(jobId, p.data.jobToken) : undefined;
                            if (jobId) {
                              const r = await fetch(`/api/jobs/${jobId}/decide`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision: d, draftHash, jobToken }) }).catch(() => null);
                              const j = (await r?.json().catch(() => null)) as { job?: { jobToken?: string } } | null;
                              if (!r?.ok) {
                                // Server refused or unreachable: revert so the card is never stuck on a false "Approved".
                                setDecisions((x) => { const n = { ...x }; delete n[m.id]; return n; });
                                return;
                              }
                              if (j?.job?.jobToken) {
                                jobToken = j.job.jobToken;
                                setJobTokens((x) => ({ ...x, [jobId]: j.job!.jobToken! }));
                              }
                            }
                            if (d === "approved") sendMessage({ text: p.data.prompt }, { body: { approved: true, jobId, draftHash, jobToken } });
                          }}
                        />
                      );
                    if (p.type === "data-email")
                      return <EmailCard key={i} sendKey={m.id} subject={p.data.subject} draft={p.data.body ?? m.parts.map((x) => (x.type === "text" ? x.text : "")).join("\n").split(DETAILS)[0]} />;
                    if (p.type === "data-chips")
                      return m.id === messages.at(-1)?.id && !busy ? (
                        <div key={i} className="flex flex-wrap gap-2">
                          {p.data.options.map((o) => (
                            <Button key={o} size="sm" variant="outline" className="rounded-full bg-card" onClick={() => sendMessage({ text: o })}>{o}</Button>
                          ))}
                        </div>
                      ) : null;
                    return null;
                  })}
                  {m.role === "assistant" && <TraceInline steps={stepsOf(m)} />}
                  {m.role === "assistant" && busy && m.id === messages.at(-1)?.id && !m.parts.some((p) => p.type === "text") && !m.parts.some((p) => p.type === "data-approval") && (
                    <span className="h-4 w-16 animate-pulse rounded bg-muted" />
                  )}
                  </div>
                </motion.div>
              ))}
              {status === "submitted" && messages.at(-1)?.role === "user" && (
                <div className="flex items-center gap-3">
                  <Mascot state="thinking" size={36} />
                  <span className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
              )}
              {error && <p className="text-sm text-destructive">Something failed: {error.message}</p>}
              <div ref={endRef} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-2xl px-4 pb-4">
            <Composer busy={busy} onStop={stop} onSend={(text, files) => sendMessage({ text, files })} />
          </div>
        </main>
      </div>
    </div>
  );
}
