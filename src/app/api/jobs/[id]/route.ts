import { NextResponse } from "next/server";
import { editDraft, getJob, publicJob } from "@/lib/jobs/store";
import { readSession } from "@/lib/jobs/session";
import { actor } from "@/lib/jobs/workflow";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const job = getJob((await params).id, req.headers.get("x-job-token") ?? undefined);
  const s = readSession(req);
  if (!job || job.sessionId !== s.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(publicJob(job));
}

/** Edit the draft. Invalidates any approval. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const job = getJob((await params).id, req.headers.get("x-job-token") ?? undefined);
  const s = readSession(req);
  if (!job || job.sessionId !== s.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { draft } = ((await req.json().catch(() => ({}))) ?? {}) as { draft?: string };
  if (typeof draft !== "string" || draft.length > 5000) return NextResponse.json({ error: "bad draft" }, { status: 400 });
  editDraft(job, actor.human(s.id), draft);
  return NextResponse.json(publicJob(job));
}
