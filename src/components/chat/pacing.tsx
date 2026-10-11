"use client";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "./markdown";

/**
 * Client-side reading pace for streamed assistant text (PACING.md §2).
 * Word credit at a fixed wpm with adaptive catch-up; plain text while revealing, Markdown once done.
 * Never slows the server: it is a view over text useChat already buffered.
 */
const doneKeys = new Set<string>();
export const SKIP_EVENT = "fixit:skip";
export const skipAll = () => window.dispatchEvent(new Event(SKIP_EVENT));
export const isPacedDone = (key: string) => doneKeys.has(key);

export const stripMd = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/^#{1,6}\s+/gm, "");

function cut(text: string, n: number) {
  if (n <= 0) return "";
  let i = 0;
  for (const m of text.matchAll(/\S+/g)) if (++i === n) return text.slice(0, m.index! + m[0].length);
  return text;
}

export function usePaced(key: string, text: string, finished: boolean, opts: { enabled: boolean; wpm?: number; maxMult?: number; onDone?: () => void }) {
  const { enabled, wpm = 400, maxMult = 4 } = opts;
  const instant = !enabled || doneKeys.has(key);
  const [shown, setShown] = useState(instant ? Infinity : 0);
  const textRef = useRef(text);
  const finRef = useRef(finished);
  const doneRef = useRef(opts.onDone);
  useEffect(() => { textRef.current = text; finRef.current = finished; doneRef.current = opts.onDone; });
  useEffect(() => {
    if (instant) return;
    let raf = 0, last = performance.now(), lastCommit = 0, credit = 0, n = 0, stopped = false;
    const finish = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); doneKeys.add(key); setShown(Infinity); doneRef.current?.(); };
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = textRef.current;
      const words = [...t.matchAll(/\S+/g)];
      const total = words.length;
      credit += (wpm / 60) * Math.min(maxMult, 1 + (total - n) / 60) * dt;
      while (credit >= 1 && n < total) {
        n++; credit--;
        const next = words[n];
        // ~120 ms beat before a new paragraph or list item.
        if (next) { const gap = t.slice(words[n - 1].index! + words[n - 1][0].length, next.index); if (gap.includes("\n")) credit -= 0.8; }
      }
      if (finRef.current && n >= total) return finish();
      if (now - lastCommit > 33) { lastCommit = now; setShown(n); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener(SKIP_EVENT, finish);
    return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener(SKIP_EVENT, finish); };
  }, [key, instant, wpm, maxMult]);
  const done = shown === Infinity;
  return { done, text: done ? text : cut(text, shown) };
}

/** Paced assistant text. Tap the block to finish all reveals. */
export function PacedText({ id, text, finished, enabled, onDone, children }: { id: string; text: string; finished: boolean; enabled: boolean; onDone?: () => void; children?: (done: boolean) => React.ReactNode }) {
  const p = usePaced(id, text, finished, { enabled, onDone });
  if (p.done) return <><Markdown>{text}</Markdown>{children?.(true)}</>;
  return (
    <div onClick={skipAll} className="paced cursor-default whitespace-pre-wrap text-[15px] leading-relaxed" aria-busy="true">
      {stripMd(p.text)}
    </div>
  );
}

/** Renders children only after `ms` (loader hold-back so fast replies never flash it). */
export function Delayed({ ms, children }: { ms: number; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), ms); return () => clearTimeout(t); }, [ms]);
  return on ? <>{children}</> : null;
}
