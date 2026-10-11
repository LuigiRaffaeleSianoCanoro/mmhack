import type { TraceStep } from "@/lib/trace";

// Turns raw trace steps into plain language. Raw strings (hashes, ids, provider names) stay out of
// the main UI and only appear under "Technical details".

export function modelName(m: string) {
  const t = m.toLowerCase();
  if (t.startsWith("jev")) return "Jev";
  if (t.includes("claude-sonnet")) return "Claude Sonnet 5";
  if (t === "gpt-5-mini") return "GPT-5 mini";
  if (t === "gpt-5") return "GPT-5";
  if (t.includes("gpt-6-astra")) return "GPT-6 Astra";
  if (t.includes("image") || t.includes("imagen") || t.includes("dall")) return "an image model";
  return "";
}
const isAI = (s: TraceStep) => s.provider === "neon-gateway" || s.provider === "typesafe";

const NAME: Record<string, string> = {
  triage: "Quick check", vision: "Photo read", confirm: "Confirmed", understand: "Reply understood", plan: "Plan written",
  "plan-fallback": "Backup plan", check: "Safety double-check", followup: "Answered", ask: "Next question", gate: "Approved",
  outbound: "Delivery", illustrate: "Illustration",
};
export function stepName(s: TraceStep) {
  if (s.id === "safety") return s.provider === "human" ? "Your approval" : "Safety stop";
  if (s.id === "vision" && s.task.startsWith("Video read")) return s.task; // video upload: "Video read by gpt-5 (5 frames)"
  return NAME[s.id] ?? s.task;
}

const WHY: Record<string, string> = {
  triage: "fastest model that caught every safety case in our tests.",
  vision: "reads photos reliably and fast enough to keep the chat snappy.",
  plan: "wrote the safest, clearest repair steps in our tests.",
  "plan-fallback": "used only because the first planner didn't answer in time.",
  check: "a different AI family catches mistakes the planner might miss.",
  confirm: "short replies don't need a big model, so this stays fast and cheap.",
  understand: "short replies don't need a big model, so this stays fast and cheap.",
  followup: "short replies don't need a big model, so this stays fast and cheap.",
  illustrate: "draws a clear picture of the repair.",
};
const JEV_WHY = "answers in about a tenth of a second and caught every hazard in our 14-case test; GPT-5 mini steps in if it's unsure or slow.";
export const whyModel = (s: TraceStep) => s.id === "triage" && s.provider === "typesafe" && s.status !== "error" ? `Why Jev: ${JEV_WHY}` : (WHY[s.id] && isAI(s) && modelName(s.model) ? `Why ${modelName(s.model) || "this model"}: ${WHY[s.id]}` : "");

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** One plain sentence: what happened and what it means for the user. */
export function stepLine(s: TraceStep, sent?: { to?: string; at?: number }): string {
  const err = s.status === "error";
  switch (s.id) {
    case "triage": {
      const jev = s.provider === "typesafe";
      if (err) return jev ? "Jev wasn't sure or was slow, so GPT-5 mini is double-checking." : "The quick check didn't finish, so we carried on without it.";
      const by = jev ? "Triaged by Jev" : s.why.startsWith("Jev fallback") ? "Triaged by GPT-5 mini (backup for Jev)" : "Quick check";
      const m = s.why.match(/Result:\s*([\w-]+),\s*(\w+)(, HAZARD)?/);
      if (!m) return `${by}.`;
      return m[3] ? `${by}: this looks like a safety hazard.` : `${by}: a ${m[1]} issue, ${m[2]} urgency.`;
    }
    case "vision":
      {
        const what = s.task.startsWith("Video read") ? "video" : "photo";
        if (err) return `We couldn't read the ${what} this time.`;
        return s.note ? `We read your ${what}: ${s.note.replace(/\.$/, "")}.` : `We read your ${what}.`;
      }
    case "confirm": return "Confirmed what we saw with you.";
    case "understand": return "Understood your reply.";
    case "followup": return "Answered your question.";
    case "ask": return "Asked the next question.";
    case "plan": return err ? "The first planner didn't respond, so we tried another." : "Wrote your repair plan.";
    case "plan-fallback": return err ? "We couldn't write a plan right now. Please try again." : "Wrote your repair plan with the backup planner.";
    case "check":
      if (err) return "The safety double-check didn't finish.";
      if (s.note?.startsWith("flag:")) return `A second AI checked the plan and flagged a concern: ${s.note.slice(5)}`;
      return s.note === "pass" ? "A second AI checked the plan for safety. Looks safe." : "A second AI checked the plan for safety.";
    case "safety":
      return s.provider === "human" ? "You chose to send a repair request to your landlord." : "Safety stop: this could be dangerous. No DIY steps; contact your landlord or emergency services.";
    case "gate":
      return err ? "This request was blocked because it changed after approval or was already handled." : "You approved this request. It can't be changed or sent twice.";
    case "outbound": {
      if (sent) return sentLine(sent);
      const st = s.why.split(":")[0];
      if (st === "sent") return "Sent to your landlord.";
      if (st === "in_flight") return "Sending…";
      if (st === "not_sent_export") return "Your request is ready to send. Nothing was sent automatically.";
      return "Sending didn't go through. Nothing was sent.";
    }
    case "illustrate":
      if (s.status === "skipped") return /hazard/i.test(s.why) ? "No illustration for hazardous repairs." : "No illustration without a photo.";
      return err ? "Illustration unavailable, so we show a reference picture." : "Drew an illustration of the repair.";
  }
  return cap(s.task);
}

export const fmtTime = (at?: number) => (at ? new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
export const sentLine = (r: { to?: string; at?: number }) => `Sent to your landlord${r.to ? ` (${r.to})` : ""}${r.at ? ` at ${fmtTime(r.at)}` : ""} from your Gmail.`;

export const secs = (ms: number) => (ms < 1000 ? "less than a second" : `${(ms / 1000).toFixed(1)} seconds`);
export function costText(c: number, unknown: boolean) {
  if (c <= 0) return unknown ? "Cost not measured for some steps" : "No AI cost";
  const s = c < 0.01 ? "Cost less than a cent" : `Cost about ${Math.round(c * 100)} cents`;
  return unknown ? `${s} (plus the illustration, not measured)` : s;
}
export const costShort = (c: number) => (c <= 0 ? "" : c < 0.01 ? "<1¢" : `${Math.round(c * 100)}¢`);

export function runsOn(steps: TraceStep[]) {
  const names = [...new Set(steps.filter(isAI).map((s) => (s.provider === "typesafe" ? "Jev by TypeSafe" : modelName(s.model))).filter(Boolean))];
  if (!names.length) return "";
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return steps.some((s) => s.provider === "typesafe") ? `Runs on ${list} (Jev via TypeSafe, the rest through Neon AI Gateway)` : `Runs on ${list} through Neon AI Gateway`;
}
