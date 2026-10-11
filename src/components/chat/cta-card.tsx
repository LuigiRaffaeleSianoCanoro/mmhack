"use client";
import { useState } from "react";
import { Copy, LogIn, Mail, SquareArrowOutUpRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/fixit/auth";
import type { Cta } from "@/lib/trace";

// AWS-67/68: inline actions for follow-ups about the current case. Buttons adapt to the live auth state.
export function CtaCard({ cta }: { cta: Cta }) {
  const auth = useAuth();
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const guest = auth?.who.guest ?? true;
  const text = `Subject: ${cta.subject ?? ""}\n\n${cta.body ?? ""}`;
  const mailto = `mailto:${encodeURIComponent(cta.to ?? "")}?subject=${encodeURIComponent(cta.subject ?? "")}&body=${encodeURIComponent(cta.body ?? "")}`;
  const has = (a: Cta["actions"][number]) => cta.actions.includes(a);
  return (
    <div className="flex max-w-md flex-wrap gap-2">
      {has("signin") && guest && (
        <Button size="sm" className="gap-2" onClick={() => auth?.signIn()}><LogIn className="size-4" />Sign in to send from Gmail</Button>
      )}
      {(has("gmail") || (has("signin") && !guest)) && !guest && auth?.gmail.enabled && !auth.gmail.connected && (
        <Button size="sm" className="gap-2" onClick={async () => {
          const j = await (await fetch("/api/gmail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "connect" }) })).json().catch(() => ({}));
          if (j.redirectUrl) window.location.href = j.redirectUrl; else setErr(j.error ?? "Could not start Gmail connect.");
        }}><Mail className="size-4" />Connect Gmail</Button>
      )}
      {has("copy") && cta.body && (
        <Button size="sm" variant="outline" className="gap-2 bg-card" onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr("Copy failed. Select the draft text above instead."); }
        }}><Copy className="size-4" />{copied ? "Copied" : "Copy draft"}</Button>
      )}
      {has("mailto") && cta.body && (
        <a href={mailto} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-2 bg-card")}><SquareArrowOutUpRight className="size-4" />Open in mail app</a>
      )}
      {err && <p role="alert" className="w-full text-sm text-destructive">{err}</p>}
    </div>
  );
}
