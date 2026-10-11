import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/fixit/site-header";

export const metadata: Metadata = { title: "Pricing · FixIt", description: "FixIt plans for renters, homeowners, buildings, HOAs, hosts and pros." };

type Plan = { name: string; who: string; price: string; points: string[]; cta?: { href: string; label: string } };
// Source: gtm/PRICING.md §1 (proposed prices, not yet live billing).
const B2C: Plan[] = [
  { name: "Free", who: "Renters and homeowners", price: "$0", points: ["3 fix plans a month", "Hazard safety stops: always free, unlimited", "Landlord-request draft: always free, unlimited"], cta: { href: "/", label: "Start free" } },
  { name: "Pro", who: "Frequent DIYers, homeowners, small landlords", price: "$4.99/mo or $34.99/yr", points: ["Unlimited fix plans", "Home history", "Priority models"] },
];
const B2B: Plan[] = [
  { name: "Building", who: "Supers, small landlords, self-managed buildings", price: "$1.00/door/mo", points: ["$25/mo minimum", "First 5 doors free"] },
  { name: "Manager", who: "Building and property managers", price: "$1.50/door/mo", points: ["$150/mo minimum", "Landlord Inbox, triage, audit trail, approval rules", "PMS integrations later"] },
  { name: "Community", who: "HOAs, condo boards, community managers", price: "$0.50/door/mo", points: ["$49/mo minimum per community", "Add-on next to your HOA software"] },
  { name: "Host", who: "Airbnb / short-term-rental hosts and co-hosts", price: "$5/listing/mo", points: ["First listing free"] },
];
const PROS: Plan = { name: "Pros", who: "HVAC, plumbing, electrical, drywall, roofing, appliance, general", price: "Free profile", points: ["Pay only per booked visit: $25 repair trades, $49 HVAC / roofing / replacement scoping", "No per-lead fees", "Optional Pro Plus $49/mo: estimate-draft and scheduling agents for your own customers", "Customers are contacted only after they approve"], cta: { href: "/pros", label: "Join as a pro" } };

function Card({ p, accent }: { p: Plan; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border bg-card p-5 ${accent ? "border-mm-accent" : ""}`}>
      <h3 className="font-display text-xl font-bold uppercase tracking-wide">{p.name}</h3>
      <p className="text-sm text-muted-foreground">{p.who}</p>
      <p className="font-display text-2xl font-bold text-mm-accent">{p.price}</p>
      <ul className="flex flex-col gap-1.5 text-sm">{p.points.map((x) => <li key={x}>· {x}</li>)}</ul>
      {p.cta && <Link href={p.cta.href} className="mt-auto inline-flex h-9 items-center justify-center rounded-md bg-mm-accent px-4 text-sm font-semibold text-black">{p.cta.label}</Link>}
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot/happy.webp" alt="" width={56} height={56} className="size-14" />
          <div>
            <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Pricing</h1>
            <p className="text-muted-foreground">Safety stops are always free. Proposed prices; billing isn&apos;t live yet.</p>
          </div>
        </div>
        <section className="flex flex-col gap-4"><h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-muted-foreground">For people at home</h2><div className="grid gap-4 sm:grid-cols-2">{B2C.map((p, i) => <Card key={p.name} p={p} accent={i === 1} />)}</div></section>
        <section className="flex flex-col gap-4"><h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-muted-foreground">For buildings, HOAs and hosts</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{B2B.map((p) => <Card key={p.name} p={p} />)}</div></section>
        <section className="flex flex-col gap-4"><h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-muted-foreground">For pros</h2><Card p={PROS} accent /></section>
      </main>
    </div>
  );
}
