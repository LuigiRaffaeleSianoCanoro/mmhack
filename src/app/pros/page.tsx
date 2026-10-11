import type { Metadata } from "next";
import { SiteHeader } from "@/components/fixit/site-header";
import { ProSignup } from "./signup";

export const metadata: Metadata = { title: "For pros · FixIt", description: "Get briefed, approved jobs from FixIt. Free profile, pay per booked visit." };

export default function ProsPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide">Join FixIt as a <span className="text-mm-accent">pro</span></h1>
        <p className="text-muted-foreground">Free profile. You get a written brief of the problem before you call back, and you pay only when a visit is booked ($25 repair / $49 HVAC, roofing, replacement scoping). Customers reach you only after they approve the message.</p>
        <ProSignup />
      </main>
    </div>
  );
}
