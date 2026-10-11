import Link from "next/link";

/** Minimal header for marketing routes (/pricing, /pros). Brand tokens only. */
export function SiteHeader() {
  return (
    <header className="flex h-12 items-center gap-4 border-b px-4">
      <Link href="/" className="flex items-center gap-1.5" aria-label="FixIt home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot/idle.webp" alt="" width={24} height={24} className="size-6" />
        <span className="font-display text-base font-bold uppercase tracking-[0.08em]">Fix<span className="text-mm-accent">It</span></span>
      </Link>
      <nav className="ml-auto flex gap-4 text-sm text-muted-foreground">
        <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
        <Link href="/pros" className="hover:text-foreground">For pros</Link>
        <Link href="/" className="hover:text-foreground">Open FixIt</Link>
      </nav>
    </header>
  );
}
