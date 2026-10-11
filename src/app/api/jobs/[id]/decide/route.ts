import { NextResponse } from "next/server";
import { decide, getJob, publicJob } from "@/lib/jobs/store";
import { readSession } from "@/lib/jobs/session";
import { actor } from "@/lib/jobs/workflow";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { decision?: string; draftHash?: string; jobToken?: string };
  const job = getJob((await params).id, body.jobToken);
  const s = readSession(req);
  if (!job || job.sessionId !== s.key) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { decision, draftHash } = body;
  if (decision !== "approved" && decision !== "rejected") return NextResponse.json({ error: "bad decision" }, { status: 400 });
  const ok = decide(job, actor.human(s.key), s.key, decision, String(draftHash ?? ""));
  return NextResponse.json({ ok, job: publicJob(job) }, { status: ok ? 200 : 409 });
}
