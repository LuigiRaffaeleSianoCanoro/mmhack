# PLAN — 3 ideas + recommended

Constraints: judge tries in <30 s from URL/QR, no login; chat UI with live ROUTING TRACE (model, why, latency, $); multimodal; human approval; every sponsor meaningful. Not: vlog editor, inbox copilot, event-to-content.

## Idea A (RECOMMENDED): "FixIt" — snap-a-problem home/landlord/repair concierge
Photo/voice of a broken thing (leaky faucet, parking ticket, error-code on appliance) → diagnosis → plan → generated "what it should look like" image → drafted action (tenant request to landlord, quote request, dispute letter) executed only after your approval.
Why multi-model is obvious: vision for the photo, fast classifier for triage/safety, cheap model for chat, strong reasoner for the plan, image gen for the illustration, governed API for the action.
## Idea B: "Second Opinion" — medical-bill / lease / contract explainer
Upload photo of a bill/lease → OCR+vision → Jev flags clause risk categories → Opus reasons, Grok cross-checks (disagreement shown) → human approves dispute letter → Swytchcode sends via fax/email API. Strong but text-heavy; less visual demo.
## Idea C: "Field Tech Copilot" for small-business ops (restaurant/shop)
Voice note + photo of shelf/equipment → inventory/issue classification → reorder via legacy supplier API (Swytchcode's sweet spot: legacy APIs) with manager approval in Anbaric workflow. Best Swytchcode story, less relatable to judges personally.

## Recommended: A — FixIt
**Problem:** Something breaks; people don't know what it is, how urgent, who to call, or how to ask. **User:** renters/homeowners (every judge).
**Flow (judge, 30 s):** scan QR → chat opens (no login, demo session) → tap 📷 sample photo or upload own / 🎤 speak → trace panel streams steps → card "Approve sending request to landlord?" [Approve/Edit/Reject] → confirmation + audit log.

### Router (Jev decides; table committed as Actual AI ADR-002)
| Step | Model | Why | Est. latency |
|---|---|---|---|
| Route intent/modality, urgency (Choice+Score), safety gate (gas/electrical→"call pro now") | Jev (TypeSafe) | 70–500 ms, calibrated confidence, can't hallucinate; low conf → ask_user | <0.5 s |
| Image understanding | gpt-5 (vision) via Neon | vision needed; one strong pass | 3–8 s |
| Small talk / clarifying Qs | gpt-5-mini | cheap/fast | ~1 s |
| Repair plan + risk reasoning | claude-opus-5-5 (only when Jev urgency≥high or complexity) / claude-sonnet-5-5 default | cost-aware escalation | 5–15 s |
| Cross-check / second opinion (live price/local info) | grok-4-6 | different provider; disagreement shown | 3–6 s |
| "Fixed" illustration / step diagram | gpt-5-5-pro image gen | modality | 10–20 s (async, non-blocking) |
| Voice in | browser Web Speech API (fallback; gateway STT unknown) | zero setup | live |
| External action | Swytchcode `exec` (dry_run → approve → exec) | governed API call | 1–2 s |
Each trace row: model, reason (Jev probabilities), latency, tokens, $ estimate, "why not a single model" tooltip.

### Sponsors
- **Jev:** the router itself (core of track).
- **Anbaric:** whole job = state machine: CODE(intake) → AGENT(diagnose/plan) → HUMAN(approve) → CODE(Swytchcode exec). Audit log w/ actor type shown in UI.
- **Swytchcode:** all outbound actions (email/SMS e.g. Twilio/SendGrid from their catalog — verify which exist) via allow-listed tooling.json + policy (e.g. no send without approval token); show dry_run preview in approval card.
- **Base44:** judge-facing "Landlord/Contractor inbox" app receiving the approved requests + judge feedback form; our app writes via @base44/sdk. Demo: approve in chat → it appears in the Base44 app on second screen.
- **Actual AI:** `npx @actualai/actual` on repo → ADRs (ADR-001 Jev-routes-LLMs-generate, ADR-002 router table, ADR-003 all actions through Swytchcode+human approval); AGENTS.md routing block for Claude Code while building.
- **Prelint:** GitHub App on repo; every PR reviewed vs ADRs; demo screenshot of Prelint flagging a PR that called an API directly (violating ADR-003) → fixed.

### 4-min demo script
0:00 Hook: "Your faucet's leaking, you don't know what to call. One model can't see, triage in 200 ms, reason, draw, and act safely." QR on screen — judges join.
0:30 Live: upload photo + voice "it's dripping under the sink". Trace streams: Jev 180 ms → gpt-5 vision → Sonnet plan; Grok disagreement callout; image appears.
1:45 Safety: second sample (burning smell from outlet) → Jev safety gate routes to "call electrician now", no LLM spend.
2:20 Human-in-loop: approval card w/ Swytchcode dry-run → Approve → appears in Base44 landlord app; Anbaric audit log shows HUMAN/AGENT/CODE.
3:10 Engineering: ADRs (Actual) + Prelint review catching a violation. Cost/latency vs "all-Opus" baseline.
3:45 Close: who uses it, what's next.

### Build plan (PT)
- 9:45–10:15 Get keys: Jev (organizers/OpenRouter), Swytchcode, Prelint, Actual, Base44, Anbaric. Repo + Vercel deploy skeleton (Next.js chat). Install Prelint; run Actual CLI.
- 10:15–12:00 Router + trace: Jev Choice/Score call, model adapters (Neon, Anthropic), streaming trace UI, sample-photo buttons.
- 12:00–12:30 Lunch / deploy check on phone via QR.
- 12:30–2:00 Anbaric state machine wrapping pipeline + approval card; Swytchcode exec with dry_run.
- 2:00–3:00 Base44 landlord app + SDK write; image gen async.
- 3:00–4:00 Voice input, safety-gate sample, cost comparison panel, ADR polish, PRs through Prelint.
- 4:00–5:00 Hardening: cached fallbacks for every sample (demo must run), rate limits, mobile layout.
- 5:00–5:30 Freeze, rehearse 3x, record backup video.

Unknowns: prizes/judges/credits; Jev key availability; Swytchcode catalog APIs & pricing; Anbaric hosted vs local; gateway STT.
