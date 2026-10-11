"use client";
import { motion, useReducedMotion } from "motion/react";
import { Mascot } from "@/components/fixit/mascot";

/** "Leave now" evacuation banner for hazard safety stops (ported from mock #s8). Reduced motion: static, same content. */
export function EvacCard({ gas }: { gas: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div role="alert" className="evac relative w-full overflow-hidden rounded-xl border-2 border-red-500/80 bg-[#3a0d0d]/90 px-5 py-6 text-center">
      <div className="mx-auto mb-3 inline-block" style={reduce ? undefined : { animation: "evac-pulse 1s ease-in-out infinite" }}>
        <Mascot state="alert" size={96} />
      </div>
      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-red-400 sm:text-3xl">{gas ? "Stop. Possible gas leak." : "Stop. Possible hazard."}</h2>
      <p className="mt-2 text-[15px] text-foreground">Don&apos;t flip switches or use flames. Leave now, leave the door open, then call from outside.</p>
      <div aria-hidden className="mx-auto mt-4 flex h-8 max-w-xs items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-red-300">
        <span>Leave now</span>
        <div className="relative h-full flex-1">
          {reduce ? (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-lg">→ 🚪</span>
          ) : (
            <>
              <span className="absolute right-0 top-1/2 -translate-y-1/2 text-lg">🚪</span>
              <motion.span className="absolute top-1/2 -translate-y-1/2 text-lg" initial={{ left: "0%", opacity: 1 }} animate={{ left: ["0%", "78%"], opacity: [1, 1, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeIn", times: [0, 0.85, 1] }}>🏃</motion.span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
