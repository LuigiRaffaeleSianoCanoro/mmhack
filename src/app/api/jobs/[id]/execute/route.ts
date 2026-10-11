import { NextResponse } from "next/server";
import { claimExecution, getJob } from "@/lib/jobs/store";
import { readSession } from "@/lib/jobs/session";
import { actor } from "@/lib/jobs/workflow";

/** Request the single execution claim for an approved draft. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { decision?: string; draftHash?: string; jobToken?: string };
  const job = getJob((await params).id, body.jobToken);
  const s = readSession(req);
  if (!job || job.sessionId !== s.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { draftHash } = body;
  const r = claimExecution(job, actor.code("execution-gate"), s.id, String(draftHash ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : 409 });
}
