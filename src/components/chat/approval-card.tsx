"use client";
import { motion, useReducedMotion } from "motion/react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApprovalRequest } from "@/lib/trace";
import { AuditDrawer } from "./audit-drawer";

export function ApprovalCard({
  request,
  decided,
  jobToken,
  onDecide,
}: {
  request: ApprovalRequest;
  jobToken?: string;
  decided?: "approved" | "rejected";
  onDecide: (d: "approved" | "rejected") => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
    >
      <Card className="border-mm-accent/40 bg-mm-accent-soft/40 max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.12em]">
            <ShieldAlert className="size-4 text-mm-accent" /> Approval needed: {request.action}
          </CardTitle>
          <CardDescription>{request.reason}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md bg-background/60 p-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{request.prompt}</p>
          {request.storeLabel && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Audited job · {request.storeLabel}</p>}
        </CardContent>
        <CardFooter className="gap-2">
          {decided ? (
            <span className="text-xs text-muted-foreground">{decided === "approved" ? "Approved. Running." : "Rejected. Nothing ran."}</span>
          ) : (
            <>
              <Button size="sm" onClick={() => onDecide("approved")}>Approve</Button>
              <Button size="sm" variant="ghost" onClick={() => onDecide("rejected")}>Reject</Button>
            </>
          )}
          {request.jobId && <AuditDrawer jobId={request.jobId} jobToken={jobToken} />}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
