"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { ArrowRight } from "lucide-react";
import { ASSISTANTS, type Assistant } from "@/lib/assistants";
import { cn } from "@/lib/utils";

const EASE = [0.23, 1, 0.32, 1] as const;

function Book({
  a,
  i,
  spread,
  active,
  opening,
  onFocus,
  onOpen,
}: {
  a: Assistant;
  i: number;
  spread: MotionValue<number>;
  active: boolean;
  opening: boolean;
  onFocus: () => void;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const y = useTransform(spread, (s) => s * i);
  // Slight width variation per book, like a real stack.
  const width = `min(${640 - ((i * 37) % 70)}px, 88vw)`;
  const titleFont = a.type === "serif" ? "font-serif italic text-[17px]" : a.type === "display" ? "font-display uppercase tracking-[0.14em] text-[15px] font-semibold" : "font-sans font-semibold text-[14px] tracking-tight";
  return (
    <motion.li style={{ y }} className="relative flex justify-center [transform-style:preserve-3d]" initial={false}>
      <motion.button
        type="button"
        onClick={onOpen}
        onMouseEnter={onFocus}
        onFocus={onFocus}
        aria-label={`${a.title}: ${a.activity} assistant. ${a.blurb}`}
        className="group relative block cursor-pointer outline-none [transform-style:preserve-3d] focus-visible:[&>.spine]:ring-2 focus-visible:[&>.spine]:ring-ring"
        style={{ width, height: "var(--book-h)" }}
        animate={reduce ? undefined : { z: opening ? 120 : active ? 36 : 0, x: active ? 10 : 0 }}
        transition={{ duration: opening ? 0.32 : 0.22, ease: EASE }}
      >
        {/* top face (page block) */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 origin-top [transform:rotateX(-90deg)]"
          style={{
            height: "var(--book-depth)",
            background: `linear-gradient(180deg, color-mix(in oklch, ${a.spine} 70%, black), color-mix(in oklch, ${a.spine} 85%, white 6%))`,
          }}
        />
        {/* spine */}
        <span
          className="spine cloth absolute inset-0 flex items-center gap-6 rounded-[3px] px-6 shadow-[inset_0_1px_0_oklch(1_0_0/12%),inset_0_-8px_16px_oklch(0_0_0/25%)]"
          style={{ backgroundColor: a.spine, color: a.ink }}
        >
          <span className="hidden w-28 shrink-0 truncate text-left font-mono sm:block text-[10px] uppercase tracking-[0.18em] opacity-75">{a.author}</span>
          <span className={cn("flex-1 truncate text-center", titleFont)}>{a.title}</span>
          <span className="font-mono text-[11px] opacity-70">{String(i + 1).padStart(2, "0")}</span>
        </span>
      </motion.button>
    </motion.li>
  );
}

export function Shelf() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [opening, setOpening] = useState<string | null>(null);
  const { scrollY } = useScroll();
  const raw = useTransform(scrollY, [0, 600], [2, 64]);
  const spread = useSpring(raw, { stiffness: 220, damping: 32, mass: 0.6 });
  const tilt = useTransform(scrollY, [0, 600], [-6, -14]);
  const a = ASSISTANTS[active];

  function open(slug: string) {
    if (reduce) return router.push(`/a/${slug}`);
    setOpening(slug);
    setTimeout(() => router.push(`/a/${slug}`), 280);
  }

  return (
    <div className="relative min-h-[200vh]">
      <header className="fixed inset-x-0 top-0 z-40 flex items-start justify-between px-5 py-4">
        <div>
          <div className="font-display text-sm font-bold uppercase tracking-[0.2em]">mm<span className="text-mm-accent">hack</span></div>
          <div className="font-serif text-[13px] italic text-muted-foreground">A shelf of assistants</div>
        </div>
      </header>

      {/* index rail, like a table of contents */}
      <nav aria-label="Assistants" className="fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
        {ASSISTANTS.map((b, i) => (
          <button
            key={b.slug}
            onClick={() => open(b.slug)}
            onMouseEnter={() => setActive(i)}
            aria-label={b.title}
            className={cn("h-px w-4 bg-muted-foreground/50 transition-[width,background-color] duration-150", i === active && "w-7 bg-mm-accent")}
          />
        ))}
      </nav>

      <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden [perspective:var(--shelf-perspective)] [perspective-origin:50%_-40%]">
        <motion.ol style={{ rotateX: reduce ? -4 : tilt }} className="flex flex-col [transform-style:preserve-3d]">
          {ASSISTANTS.map((b, i) => (
            <Book key={b.slug} a={b} i={i} spread={spread} active={i === active} opening={opening === b.slug} onFocus={() => setActive(i)} onOpen={() => open(b.slug)} />
          ))}
        </motion.ol>
      </div>

      {/* caption card: ribbed glass */}
      <div className="fixed inset-x-5 bottom-5 z-40 sm:left-auto sm:w-80">
      <motion.aside
        key={a.slug}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="ribbed-glass overflow-hidden rounded-xl border p-4"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mm-accent">{String(active + 1).padStart(2, "0")} / {a.activity}</p>
        <h1 className="mt-1 font-display text-2xl font-bold uppercase leading-none">{a.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{a.blurb}</p>
        <button onClick={() => open(a.slug)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-mm-accent">
          Open <ArrowRight className="size-4" />
        </button>
      </motion.aside>
      </div>

      <p className="fixed bottom-6 left-5 z-40 hidden font-serif text-xs italic text-muted-foreground lg:block">Scroll to fan the shelf. Click a book to open it.</p>
    </div>
  );
}
