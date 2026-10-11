"use client";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { IMAGE_MODEL, fallbackSrc, type IllustrationRequest, type IllustrationResult } from "@/lib/illustration";
import type { TraceStep } from "@/lib/trace";

const PENDING_MS = 20_000;
const CLIENT_DEADLINE_MS = 60_000;

/** Fetches the optional illustration after the plan; never blocks plan or approval. */
export function IllustrationCard({ request, onTrace }: { request: IllustrationRequest; onTrace: (s: TraceStep) => void }) {
  const [result, setResult] = useState<IllustrationResult>();
  const [slow, setSlow] = useState(false);
  const started = useRef(false);
  const traceRef = useRef(onTrace);
  useEffect(() => {
    traceRef.current = onTrace;
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const base: TraceStep = { id: "illustrate", task: "Repair illustration", model: request.mode === "sample" ? "pre-generated" : IMAGE_MODEL, provider: "neon-gateway", why: "Async, optional, non-instructional. Image cost is not measured.", status: "running", costUnknown: true };
    traceRef.current(base);
    const t0 = performance.now();
    const slowTimer = setTimeout(() => setSlow(true), PENDING_MS);
    const simulate = new URLSearchParams(window.location.search).get("simulateImage") ?? undefined;
    fetch("/api/fixit/illustrate", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(CLIENT_DEADLINE_MS), body: JSON.stringify({ ...request, simulate }) })
      .then((r) => (r.ok ? (r.json() as Promise<IllustrationResult>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      // Transport/deadline failure: still show the labelled pre-generated image, never a broken state.
      .catch((): IllustrationResult => ({ status: "fallback", src: fallbackSrc(request.category), reason: "Live illustration unavailable; showing a pre-generated sample.", latencyMs: Math.round(performance.now() - t0), attempts: 1 }))
      .then((r) => {
        clearTimeout(slowTimer);
        setResult(r);
        traceRef.current({
          ...base,
          model: r.status === "live" ? r.model : r.attempts ? `${IMAGE_MODEL} → sample` : request.mode === "sample" ? "pre-generated" : IMAGE_MODEL,
          status: r.status === "unavailable" ? "skipped" : "done",
          latencyMs: r.latencyMs,
          why: r.status === "live" ? `Generated live by ${r.model} (JPEG, ${r.attempts} attempt${r.attempts > 1 ? "s" : ""}). Image cost unknown.` : `${r.reason}${r.attempts ? ` Attempts: ${r.attempts}.` : " No image API call."}`,
        });
      });
    return () => clearTimeout(slowTimer);
  }, [request]);

  if (result?.status === "unavailable")
    return <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ImageIcon className="size-3.5" />{result.reason}</p>;

  return (
    <figure className="max-w-sm overflow-hidden rounded-lg border bg-card">
      {result ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.src} alt={`Illustration of a ${request.category} repair`} className="aspect-square w-full object-cover" />
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-muted text-xs text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {slow ? "Still drawing the illustration… your plan above is ready to use." : "Drawing an illustration…"}
        </div>
      )}
      <figcaption className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
        {!result ? `${IMAGE_MODEL} · pending` : result.status === "live" ? `Live · ${result.model} · illustrative only, not instructions · cost unknown` : "Pre-generated sample illustration · not live · illustrative only, not instructions"}
      </figcaption>
    </figure>
  );
}
