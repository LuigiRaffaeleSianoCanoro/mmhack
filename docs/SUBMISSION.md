# FixIt: BuilderBase submission answers (draft)

Before pasting, check the authenticated BuilderBase form. Its fields and limits weren't publicly visible (see EVENT_INFO.md). Every claim here is backed by the repo, the live app, or JUSTIFICATION.md. Remove anything you can't show live.

## Basics
- **Project name:** FixIt
- **One-liner:** Snap a photo of something broken at home. FixIt tells you whether it's an emergency, gives you a safe next step, and drafts the request to your landlord. Nothing is sent until you approve it.
- **Live URL:** https://mmhack.vercel.app (you can continue as a guest, no signup)
- **Repo:** https://github.com/LuigiRaffaeleSianoCanoro/mmhack
- **Demo video:** <paste link from AWS-63>
- **Team:** Luigi Canoro

## Problem (important problem)
Renters and guests often can't tell a drip from an emergency, like a gas smell or a scorched outlet. They also don't know what to tell the person responsible for fixing it. Getting this wrong is either dangerous or slow and expensive. FixIt starts where the problem shows up: a phone photo and a sentence, in the user's own language.

## What it does (end-to-end demo)
1. Upload or paste a photo and describe the issue.
2. FixIt says what it sees in one line and asks you to confirm. It then asks 1-2 clarifying questions with tap-to-answer chips.
3. You get a short, safe repair plan and a drafted landlord request on an approval card. Nothing is sent automatically.
4. Hazards stop the flow on any turn (gas, sparks, smoke, flooding, CO, and Spanish equivalents). The user sees emergency guidance and no DIY plan.
5. Every answer has a live trace: which model ran each step, how long it took, and the cost when usage is reported. Each step has a "Why this model?" link to the ADR.

## Multiple models (how and why)
Each step runs on the model that did best in a small bake-off we ran on the day of the event (JUSTIFICATION.md, ADR-002). All calls go through the Neon AI Gateway:
- **Triage and plan cross-check:** gpt-5-mini. The cross-check comes from a different model family than the planner.
- **Photo understanding:** gpt-5.
- **Repair plan and landlord draft:** Claude Sonnet (claude-sonnet-5 via the gateway). It falls back to gpt-5 automatically, and the trace shows the fallback.
- **Repair illustration:** gpt-6-astra, generated asynchronously. Samples use pre-generated images labeled as such.
- **Tested and cut:** Grok won no step. Jev/TypeSafe triage scored 2/5 against gpt-5-mini's 5/5 on hazard cases, so it stays off.

We compared this against running Opus on every step. The routed pipeline came out about 4x cheaper (~$0.009 vs ~$0.038 per request) and faster (~13 s vs ~22 s). That's directional: 3-5 cases per task.

## Novelty / differentiation
- Model routing per step, measured, with the evidence visible to the user in the trace.
- Safety-first: deterministic rules plus the model's hazard flag. A hazard visible only in the photo also blocks the plan.
- Human approval before anything leaves the app, with an audit trail of who did what (You / AI / Safety rules).
- A built-in path to the person who actually fixes it (the landlord request), not just advice.

## Production readiness
- Deployed on Vercel from main, with every merged PR auto-deployed (#1-#18 plus the hardening PR).
- Approval is bound to the exact draft (hash). Editing the draft invalidates the approval, and execution is idempotent (PRs #3, #6, #7).
- The plan step has a timeout and a fallback model. Errors are shown in the trace with keys scrubbed (#5).
- Upload size limits and per-session/IP request quotas (AWS-61). The quotas are best-effort and count per serverless instance.
- Magic-link sign-in or guest mode. The profile is stored only on the device, and models see only city/ZIP (#15, #16).
- Architecture decisions recorded as ADRs (docs/adr).
- **Honest limitations:** small evaluation set. No durable rate limiter. Profile isn't synced across devices. Image cost isn't measured. Base44 delivery: state only what you verified live before submitting.

## Sponsor tools used
- **Neon AI Gateway:** routes every model call.
- **Anbaric:** job state model and audit trail behind the approval card (signed job, cloud sync off).
- **Swytchcode:** governs the outbound landlord notice, with a dry-run preview on the approval card and one execution.
- **Actual AI:** architecture decision records behind every "Why this model?" link.
- **Base44:** Landlord Inbox companion app (https://simple-land-flow-fix.base44.app). Delivery code is in PR #7. Confirm it works live before claiming delivery.
- **Prelint:** include only if AWS-57 was completed. Link the real review.

## Business model (if asked)
Free for renters and guests. The people who receive the requests pay: supers, property managers, HOAs and hosts pay per door or listing, and pros pay per booked visit. Sources are in gtm/RESEARCH.md.
