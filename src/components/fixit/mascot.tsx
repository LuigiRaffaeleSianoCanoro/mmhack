"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type MascotState = "idle" | "thinking" | "happy" | "alert";

const LABEL: Record<MascotState, string> = {
  idle: "FixIt",
  thinking: "FixIt is thinking",
  happy: "FixIt is done",
  alert: "FixIt safety stop",
};
// Bottom edge of the hard hat per pose (fraction of image height), used to split a hat layer.
const HAT_LINE: Record<MascotState, number> = { idle: 0.3, thinking: 0.31, happy: 0.29, alert: 0.29 };

/** Floating brick-in-a-hard-hat mascot. Emotion = eyes, mouth, hat tilt and body tilt (no limbs). */
export function Mascot({ state = "idle", size = 32, className }: { state?: MascotState; size?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (reduce || state !== "idle") return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        t = setTimeout(() => {
          setBlink(false);
          loop();
        }, 130);
      }, 3200 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(t);
  }, [reduce, state]);

  const src = `/mascot/${state}.webp`;
  const body = reduce
    ? undefined
    : {
        idle: { y: ["0%", "-4%", "0%"], transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const } },
        thinking: { y: ["0%", "-3%", "0%"], rotate: [-1.5, 1.5, -1.5], transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const } },
        happy: { y: ["0%", "-14%", "0%"], scaleY: [0.92, 1.05, 1], scaleX: [1.06, 0.97, 1], transition: { duration: 0.7, ease: [0.3, 1.5, 0.5, 1] as const } },
        alert: { x: ["0%", "-4%", "2%", "0%"], transition: { duration: 0.4, ease: "easeOut" as const } },
      }[state];
  const hat = reduce || state !== "thinking" ? undefined : { rotate: [0, -6, 0, 4, 0], transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const } };
  const line = HAT_LINE[state];

  return (
    <span role="img" aria-label={LABEL[state]} className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {state === "alert" && !reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-[-8%] rounded-full"
          style={{ boxShadow: "0 0 0 2px var(--mm-warn)" }}
          initial={{ opacity: 0.8, scale: 0.85 }}
          animate={{ opacity: 0, scale: 1.15 }}
          transition={{ duration: 1.6, repeat: 2, ease: "easeOut" }}
        />
      )}
      <motion.span key={state} className="absolute inset-0" style={{ originX: 0.5, originY: 1 }} animate={body}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={size} height={size} draggable={false} className="absolute inset-0 size-full select-none drop-shadow-[0_4px_8px_oklch(0_0_0/0.45)]" />
        {hat && (
          <motion.span aria-hidden className="absolute inset-0" style={{ clipPath: `inset(0 0 ${(1 - line) * 100}% 0)`, originX: 0.5, originY: line }} animate={hat}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-full select-none" draggable={false} />
          </motion.span>
        )}
        {state === "idle" && (
          <span
            aria-hidden
            className="absolute"
            style={{
              left: "39%", right: "31%", top: "39.8%", height: "14%",
              transformOrigin: "50% 0", transform: `scaleY(${blink ? 1 : 0})`, transition: "transform 60ms",
              background: "radial-gradient(ellipse 19% 50% at 18.6% 50%, #df6e49 97%, transparent 100%), radial-gradient(ellipse 19% 50% at 81.4% 50%, #df6e49 97%, transparent 100%)",
            }}
          />
        )}
      </motion.span>
    </span>
  );
}
