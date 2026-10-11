# Base44 "Landlord Inbox" companion app (AWS-59)

FixIt (Next.js) writes approved landlord requests into a Base44 app through `@base44/sdk`, server-side only (`src/lib/inbox/base44.ts`).

## Builder prompt (paste into app.base44.com → Create app)

> Build an app called "Landlord Inbox". It is a second-screen inbox where a landlord receives repair requests sent by tenants from an external app called FixIt. Do not add tenant signup or request creation forms; requests arrive only through the API.
>
> Entities:
> 1. **Request** with fields: title (text, required), urgency (enum: low, medium, high, emergency), category (text), body (long text: the tenant's request letter), plan_summary (text), photo_url (text/url), audit_url (text/url), status (enum: new, acknowledged, scheduled, resolved, rejected; default new), draft_hash (text), idempotency_key (text, unique), source (text, default "FixIt").
> 2. **Approval** with fields: request_id (text), decision (enum: approved, rejected), draft_hash (text), session_ref (text), decided_at (datetime).
> 3. **AuditEvent** with fields: request_id (text), actor (enum: HUMAN, CODE, AGENT), event (text), draft_hash (text), idempotency_key (text), detail (text).
>
> Pages:
> - **Inbox**: a list of Requests, newest first. Show a colored urgency badge (emergency red, high orange, medium yellow, low gray), the title, category, status, and relative time. Add filters for status and urgency, and pin emergency requests to the top.
> - **RequestDetail** (URL param `id`): show the full body, plan summary, the photo if photo_url is set, the audit link, the draft hash, the receipt id (the record id), and a timeline of AuditEvents for this request (actor badge + event + time). Add buttons to change status to acknowledged, scheduled, resolved, or rejected. Each change creates an AuditEvent with actor HUMAN.
>
> Permissions: only logged-in users can read or update requests. Allow create on Request and AuditEvent for authenticated users (the FixIt server signs in as a dedicated bot user). Clean, calm design, mobile friendly.

## After creating it
1. Copy the app ID from the editor URL and set `BASE44_APP_ID`. Set `BASE44_APP_URL` to the published URL.
2. Give the server credentials (server env only): an app API key (`BASE44_API_KEY`) if available, or invite a bot user and set `BASE44_BOT_EMAIL`/`BASE44_BOT_PASSWORD`.
3. Without these, `/api/inbox` stores the request locally and the UI says **export only**. It never claims delivery.

## Guarantees
- An approval is bound to the session cookie (`fixit_sid`) plus `sha256(draft)`. Edits change the hash, so the server answers 409 and the user must approve again. A foreign session gets 403. A rejection creates nothing.
- Durable idempotency record (`.data/inbox.json`, keyed by sha256(session:hash)) behind an in-process lock. Double clicks and replays return the existing record.
- "Delivered" is shown only after Base44 returns a record id (the receipt). An error or lost response leaves the state `unknown`, and the next attempt reconciles by `idempotency_key` before creating anything.
- Swytchcode governance: not integrated in this PR (no supported adapter verified). The dry run is local validation plus a read-only Base44 reachability check.
