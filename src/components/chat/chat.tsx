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
import { DeliverCard } from "./deliver-card";
import { IllustrationCard } from "./illustration-card";
import { EmailCard, loadSent, useSent } from "./email-card";
import { CtaCard } from "./cta-card";
import { EvacCard } from "./evac-card";
import { ProsCard } from "./pros-card";
import { inferTrade, recommendsPro } from "@/lib/pros/shared";
import { useAuth } from "@/components/fixit/auth";
import { Markdown } from "./markdown";
import { Delayed, PacedText, isPacedDone, skipAll } from "./pacing";
import { Composer } from "./composer";
import { TraceInline } from "./trace-inline";
import type { TraceStep } from "@/lib/trace";
import { loadProfile, toServer } from "@/lib/profile";

const DETAILS = "<!--details-->";
const HINTS = "fixit.client";
const readHints = () => { try { return JSON.parse(sessionStorage.getItem(HINTS) ?? "{}"); } catch { return {}; } };
import type { MMMessage } from "@/lib/trace";
import { cn } from "@/lib/utils";

export function Chat({ slug, profileUid, sessionId, initialMessages, onMessages, headerLeft }: { slug: string; profileUid?: string; sessionId?: string; initialMessages?: MMMessage[]; onMessages?: (m: MMMessage[]) => void; headerLeft?: React.ReactNode }) {
  const assistant = getAssistant(slug)!;
  const reduce = useReducedMotion();
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected">>({});
  const [illus, setIllus] = useState<Record<string, TraceStep>>({});
  // Latest server-signed job snapshots (AWS-54), so audit state survives serverless instance changes.
  const [jobTokens, setJobTokens] = useState<Record<string, string>>({});
  const auth = useAuth();
  const { messages, sendMessage, status, stop, error } = useChat<MMMessage>({
    id: sessionId ?? `mmhack-${slug}`,
    messages: initialMessages,
    // Profile is read at send time from this device (FixIt memory); the server strips it per step.
    // client: hints for follow-up copy only (guest/Gmail/sent); the server never authorizes anything from them.
    transport: new DefaultChatTransport({ api: assistant.api ?? "/api/chat", body: () => ({ assistant: slug, profile: profileUid ? toServer(loadProfile(profileUid)) : undefined, client: readHints() }) }),
  });
  useEffect(() => {
    const sent = loadSent(auth?.who.id ?? "guest");
    try { sessionStorage.setItem(HINTS, JSON.stringify({ guest: auth?.who.guest ?? true, gmailEnabled: auth?.gmail.enabled ?? false, gmailConnected: auth?.gmail.connected ?? false, sent: messages.some((m) => sent[m.id]?.ok) })); } catch {}
  }, [auth, messages]);
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
  // Hazard pacing: new safety-stop replies show the evacuation alert alone for 2s, then the text types in
  // word by word (~250 wpm) while the alert stays in view; other cards appear after. Reduced motion: no pacing.
  const isHazard = (m: MMMessage) => m.role === "assistant" && m.parts.some((p) => p.type === "data-trace" && p.data.id === "safety");
  /* eslint-disable react-hooks/set-state-in-effect -- timed reveal driven by stream status */
  const seen = useRef(new Set((initialMessages ?? []).map((m) => m.id)));
  const [pace, setPace] = useState<{ id: string; words: number } | null>(null);
  const evacRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const last = messages.at(-1);
    if (!last || seen.current.has(last.id)) return;
    if (busy && isHazard(last) && !reduce) { setPace((p) => (p?.id === last.id ? p : { id: last.id, words: -1 })); return; }
    if (busy) return;
    seen.current.add(last.id);
    if (!isHazard(last) || reduce) { setPace(null); return; }
    const total = last.parts.reduce((a, p) => a + (p.type === "text" ? p.text.split(DETAILS)[0].split(/\s+/).filter(Boolean).length : 0), 0);
    setPace({ id: last.id, words: -1 });
    let n = 0, iv: ReturnType<typeof setInterval> | undefined;
    const t = setTimeout(() => {
      iv = setInterval(() => { n += 1; setPace(n >= total ? null : { id: last.id, words: n }); if (n >= total) clearInterval(iv); }, 240);
    }, 2000);
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [messages, busy, reduce]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Reading pace + scroll (PACING.md §2, §4): follow new content only while the reader is at the bottom.
  const [history] = useState(() => new Set((initialMessages ?? []).map((m) => m.id)));
  const [, bump] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const userAt = useRef(0);
  const hazardLast = useRef(false);
  const [pill, setPill] = useState<null | "new" | "alert">(null);
  const lastMsg = messages.at(-1);
  const hazardNow = !!lastMsg && isHazard(lastMsg);
  useEffect(() => { hazardLast.current = hazardNow; });
  useEffect(() => {
    const el = scrollRef.current, c = contentRef.current;
    if (!el || !c) return;
    const onScroll = () => { stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (stuck.current) setPill((p) => (p === "new" ? null : p)); };
    const onUser = () => { userAt.current = Date.now(); };
    const ro = new ResizeObserver(() => { if (hazardLast.current) return; if (stuck.current) el.scrollTop = el.scrollHeight; else setPill((p) => p ?? "new"); });
    ro.observe(c);
    el.addEventListener("scroll", onScroll, { passive: true });
    for (const ev of ["wheel", "touchmove", "keydown"]) el.addEventListener(ev, onUser, { passive: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") skipAll(); };
    window.addEventListener("keydown", onKey);
    return () => { ro.disconnect(); el.removeEventListener("scroll", onScroll); for (const ev of ["wheel", "touchmove", "keydown"]) el.removeEventListener(ev, onUser); window.removeEventListener("keydown", onKey); };
  }, []);
  // Sending means "I'm back": jump to the bottom.
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  useEffect(() => {
    const el = scrollRef.current;
    if (!lastUserId || !el || history.has(lastUserId)) return;
    stuck.current = true;
    el.scrollTop = el.scrollHeight;
  }, [lastUserId, history]);
  // Hazard: bring the alert into view unless the reader scrolled in the last 5s; then offer a pill instead.
  useEffect(() => {
    if (!(pace || hazardNow)) return;
    if (Date.now() - userAt.current > 5000) evacRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    else setPill("alert");
  }, [messages, reduce, pace, hazardNow]);
  const paceable = (m: MMMessage) => !reduce && m.role === "assistant" && !history.has(m.id) && !isHazard(m) && m.id === messages.at(-1)?.id;
  const textKeys = (m: MMMessage) => m.parts.flatMap((p, i) => (p.type === "text" ? [`${m.id}:${i}`] : []));
  const pacing = (m: MMMessage) => paceable(m) && textKeys(m).some((k) => !isPacedDone(k));
  const revealing = !!lastMsg && pacing(lastMsg);
  // Never hide failure: show buffered text at once on error.
  useEffect(() => { if (error) skipAll(); }, [error]);
  const typed = (text: string, words: number) => { const w = text.split(/(\s+)/); return w.slice(0, Math.max(0, words) * 2).join(""); };

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
        <Link href="/" className="flex items-center gap-1.5 text-foreground transition-opacity hover:opacity-85" aria-label="FixIt home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot/idle.webp" alt="" width={24} height={24} className="size-6 select-none" draggable={false} />
          <span className="font-display text-base font-bold uppercase leading-none tracking-[0.08em]">
            Fix<span className="text-mm-accent">It</span>
          </span>
        </Link>
        <Link href="/pricing" className="ml-auto text-xs text-muted-foreground hover:text-foreground">Pricing</Link>
        <Link href="/pros" className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline">For pros</Link>
        <span className="font-mono text-[10px] text-muted-foreground" title="Session model cost (estimate)">session ${sessionCost.toFixed(3)}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div ref={contentRef} className="mx-auto flex min-h-full max-w-2xl flex-col gap-5 chat-legible bg-background/50 px-4 py-6 backdrop-blur-[3px] shadow-[0_0_60px_30px_oklch(0.125_0.005_300/0.3)]">
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
                  initial={reduce || m.role === "user" ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                  className={cn("flex gap-3", m.role === "user" && "justify-end")}
                >
                  {m.role === "assistant" && <Mascot state={mascotStateOf(m)} size={36} className="mt-0.5" />}
                  <div className={cn("flex min-w-0 flex-1 flex-col gap-2", m.role === "user" && "items-end")}>
                  {m.role === "assistant" && m.parts.some((p) => p.type === "data-trace" && p.data.id === "safety") && (
                    <div ref={m.id === messages.at(-1)?.id ? evacRef : undefined} className="scroll-mt-4"><EvacCard gas={m.parts.some((p) => p.type === "text" && /gas leak/i.test(p.text))} /></div>
                  )}
                  {m.parts.map((p, i) => {
                    if (pace?.id === m.id) {
                      if (p.type !== "text" || pace.words < 0) return null;
                      return <div key={i} className="max-w-[85%]" aria-live="polite"><Markdown>{typed(p.text.split(DETAILS)[0], pace.words)}</Markdown></div>;
                    }
                    if (pacing(m) && p.type !== "text" && p.type !== "file") return null;
                    if (p.type === "text" && m.role === "assistant")
                      {
                      const [head, more] = p.text.split(DETAILS);
                      const key = `${m.id}:${i}`;
                      const on = paceable(m);
                      // One focus at a time: a later text part waits for the earlier ones.
                      if (on && textKeys(m).slice(0, textKeys(m).indexOf(key)).some((k) => !isPacedDone(k))) return null;
                      const fin = !(busy && m.id === messages.at(-1)?.id) || more !== undefined || textKeys(m).at(-1) !== key;
                      return (
                        <div key={i} className="max-w-[85%]">
                          <PacedText id={key} text={head} finished={fin} enabled={on} onDone={() => bump((x) => x + 1)}>
                            {() => more?.trim() && (
                              <details className="mt-2 rounded-md border border-border bg-card/80 px-3 py-2 text-sm">
                                <summary className="cursor-pointer text-mm-accent">Show details</summary>
                                <div className="mt-2"><Markdown>{more}</Markdown></div>
                              </details>
                            )}
                          </PacedText>
                        </div>
                      );
                    }
                    if (p.type === "text" && m.metadata?.approval)
                      return <span key={i} className="self-center rounded-full border border-emerald-500/40 px-3 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400">✓ You approved the request</span>;
                    if (p.type === "data-cta") return <CtaCard key={i} cta={p.data} />;
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
                    if (p.type === "data-delivery")
                      return busy && m.id === messages.at(-1)?.id ? null : <DeliverCard key={i} ready={p.data} draftText={p.data.body ?? m.parts.map((q) => (q.type === "text" ? q.text : "")).join("").trim()} />;
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
                            if (d === "approved") sendMessage({ text: "Approved", metadata: { approval: true } }, { body: { approved: true, jobId, draftHash, jobToken } });
                          }}
                        />
                      );
                    if (p.type === "data-email")
                      return <EmailCard key={i} sendKey={m.id} jobKey={p.data.sendKey} sentRec={p.data.sent} defaultTo={p.data.to ?? (profileUid ? loadProfile(profileUid)?.landlordEmail : undefined)} subject={p.data.subject} draft={p.data.body ?? m.parts.map((x) => (x.type === "text" ? x.text : "")).join("\n").split(DETAILS)[0]} />;
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
                  {m.role === "assistant" && !pacing(m) && <TraceFor m={m} steps={stepsOf(m)} />}
                  {m.role === "assistant" && !(busy && m.id === messages.at(-1)?.id) && pace?.id !== m.id && !pacing(m) && <ProsFor m={m} messages={messages} zip={profileUid ? loadProfile(profileUid)?.zip ?? "" : ""} />}
                  {m.role === "assistant" && busy && m.id === messages.at(-1)?.id && !m.parts.some((p) => p.type === "text") && !m.parts.some((p) => p.type === "data-approval") && (
                    <Delayed ms={300}><span className="h-4 w-16 animate-pulse rounded bg-muted" /></Delayed>
                  )}
                  </div>
                </motion.div>
              ))}
              {status === "submitted" && messages.at(-1)?.role === "user" && (
                <Delayed ms={300}>
                  <div className="flex items-center gap-3" aria-live="polite">
                    <Mascot state="thinking" size={36} />
                    <span className="h-4 w-16 animate-pulse rounded bg-muted" />
                    <span className="sr-only">FixIt is thinking…</span>
                  </div>
                </Delayed>
              )}
              {error && <p className="text-sm text-destructive">Something failed: {error.message}</p>}
              <div ref={endRef} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-2xl px-4 pb-4">
            <div className="pointer-events-none relative z-20 -mt-12 mb-2 flex h-10 items-center justify-center gap-2">
              {pill === "alert" && (
                <Button size="sm" className="pointer-events-auto rounded-full bg-red-600 text-white hover:bg-red-500" onClick={() => { setPill(null); evacRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }}>⚠ Safety alert ↓</Button>
              )}
              {pill === "new" && (
                <Button size="sm" variant="outline" className="pointer-events-auto rounded-full bg-card" onClick={() => { setPill(null); stuck.current = true; scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" }); }}>↓ New</Button>
              )}
              {revealing && (
                <Button size="sm" variant="ghost" className="pointer-events-auto ml-auto rounded-full bg-card/80 text-xs" onClick={skipAll}>Show all</Button>
              )}
            </div>
            <Composer busy={busy} onStop={() => { skipAll(); stop(); }} onSend={(text, files) => { skipAll(); sendMessage({ text, files }); }} />
          </div>
        </main>
      </div>
    </div>
  );
}

// The trace reflects the real Gmail send for this message (a sent email beats the export status).
function TraceFor({ m, steps }: { m: MMMessage; steps: TraceStep[] }) {
  const auth = useAuth();
  const sent = useSent(m.id, auth?.who.id ?? "guest");
  return <TraceInline steps={steps} sent={m.parts.some((p) => p.type === "data-email") ? sent : undefined} />;
}

// Recommended pros: only when the plan says to call a professional, or after a safety stop.
function ProsFor({ m, messages, zip }: { m: MMMessage; messages: MMMessage[]; zip: string }) {
  const txt = (x: MMMessage) => x.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
  const hazard = m.parts.some((p) => p.type === "data-trace" && p.data.id === "safety");
  const reply = txt(m);
  if (!hazard && !recommendsPro(reply)) return null;
  const idx = messages.indexOf(m);
  const problem = [...messages.slice(0, idx)].reverse().find((x) => x.role === "user");
  const ask = problem ? txt(problem) : "";
  return <ProsCard trade={inferTrade(`${ask} ${reply}`)} zip={zip} problem={ask || "See the FixIt summary."} hazard={hazard} />;
}
