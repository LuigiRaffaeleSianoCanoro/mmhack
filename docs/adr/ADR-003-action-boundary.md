# ADR-003: Approval and governed-action boundary

- Status: Accepted (2026-10-11)
- Evidence: route.ts safety stop + `approved` flow; JUSTIFICATION.md sponsor table (Anbaric, Swytchcode, Base44)

## Two kinds of calls
- **Model inference calls** (triage, vision, plan, cross-check, image) read user input and produce text/images. No human approval needed; they are traced.
- **Outbound business actions** (email/SMS to a landlord, creating a request in another system, any API with side effects) change the world. They always need human approval.

## Decision
1. **Server-side approval validation.** The client `approved: true` flag is not trusted alone. Before any outbound action the server checks an approval record bound to the exact draft (draft id + content hash) it showed the user. Changed draft = new approval.
2. **Governed execution.** Outbound calls go only through the allow-listed executor (Swytchcode) with a dry-run shown on the approval card, then execution. No direct third-party API calls from route handlers.
3. **Idempotency.** Each action carries an idempotency key derived from the approval id; retries never send twice.
4. **Unknown outcomes.** A timeout or ambiguous response is recorded as `unknown`, shown to the user, and not auto-retried; a human decides.
5. **Hazard path.** A hazard (text rules, triage, or post-vision) blocks DIY plans; the only allowed continuation is drafting a landlord request, which is never sent automatically.
6. **Audit.** Each step records who acted (HUMAN/AGENT/CODE) for the Anbaric audit timeline.
7. **Base44 seam (M3).** The landlord inbox is reached only server-side through the Base44 SDK, behind the same approval + governed-executor path. No Base44 keys or calls in client code.

## Current state
Today the app only drafts the landlord request after approval; nothing is sent. Items 1–4 and 7 apply as soon as any send is added.
