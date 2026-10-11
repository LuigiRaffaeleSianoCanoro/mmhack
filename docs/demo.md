# FixIt: four-minute judge demo

Source: Sonya Slides deck v4 (`fixit-pitch-v4.pptx`, speaker notes `notes-v4.json`, ~454 words, ~3:15 spoken). Live app: https://mmhack.vercel.app. Backup video shot list: see the end of this file.

Rule: show only what works live. If a step fails on stage, say so and switch to the backup video.

## Pre-flight (5 min before)
- Fresh guest session on desktop (1280x900) and phone. Faucet sample photo ready to paste.
- Open the Base44 Landlord Inbox companion tab: https://simple-land-flow-fix.base44.app
- Backup MP4 open locally, paused at 0:00.

## Run of show

### 1. Hook + QR (0:00)

Something under your sink is leaking. Or you smell gas by the stove. Most of us can't tell which one is an emergency or what to do first. I built FixIt today for that. Scan the code and continue as guest. No signup.

### 2. Live demo: faucet photo to approval (0:15)

Here's the live app. I snap my kitchen faucet. It says the spray hose came off the spout. I confirm. It asks if I rent, then asks one question about the clip. Now I get a five-step plan plus a draft request to my landlord. Nothing goes out until I press Approve.

### 3. Routing: one model per step (0:40)

Each step gets the model that won it in a bake-off I ran this morning. gpt-5-mini does triage. It flagged the gas and outlet cases for a seventh of Sonnet's cost. gpt-5 reads the photo. It scored 8 out of 10 and Opus got 8.3, but gpt-5 is a fifth of the cost and twice as fast. Claude Sonnet writes the plan, gpt-5-mini checks it from a different model family, and gpt-6-astra draws the fix. Grok won nothing, so I cut it. Every call goes through the Neon AI Gateway.

### 4. Cost (directional) (1:15)

Compared to running Opus on every step, the routed pipeline came out about four times cheaper per request. Under a cent versus almost four cents. 13 seconds versus 22. It's a small test, three to five cases per task, so treat it as directional.

### 5. Safety stop + human approval (1:35)

Now safety. I type "I smell gas near the stove." It stops. No repair plan. Leave, and call 911 or the gas company from outside. Two layers catch it: keyword rules and the triage model's hazard flag. Then it offers an urgent landlord request, and I still approve it first.

### 6. Sponsors: what is live (2:00)

Here's what's live from the sponsors. Anbaric's state model audits every job, and the Audit drawer shows who approved what. Swytchcode governs the send and shows a preview on the approval card. Actual AI's decision records sit behind every "Why this model?" link. The Base44 Landlord Inbox is a companion app. Delivery from FixIt isn't wired yet.

### 7. Production readiness (2:25)

What's real today: continue as guest or sign in to keep your history, and paste photos straight in. If the plan model fails, an automatic retry takes over and the trace shows it. Not done yet: Base44 delivery and a bigger test set.

### 8. Business model (2:45)

It's free for anyone. Paid by the people who receive the requests: supers, property managers, HOAs and hosts pay per door or listing, and pros pay per booked visit.

### 9. Go-to-market (2:55)

We start where the photo is taken, with renters and guests, and sell to whoever gets the request. Pros pay when a visit is booked, not per lead.

### 10. Close (3:05)

FixIt is live at mmhack.vercel.app. Scan it, describe something broken, and tell me what it got wrong. Thanks.

## On-screen beats (live app)
1. Continue as guest, then paste the faucet photo and send "This is leaking. What do I do?"
2. Confirm the one-line read ("Yes"), answer 1-2 chip questions.
3. Scroll the plan to the approval card; point at "Nothing is sent automatically" and the governed preview.
4. Open the trace; click "Why this model?" on the plan step (ADR-002).
5. New chat: "I smell gas near the stove." Show the stop, no plan. Open Audit.

## Honesty guardrails
- Cost and latency figures come from a small bake-off (3-5 cases per task) in JUSTIFICATION.md. Say "directional".
- The sample photo's illustration is pre-generated and labeled that way.
- Base44: say only what you verified on the live site just before the demo. The deck v4 script says delivery is not wired. PR #7 merged the delivery code, but it depends on production credentials.
- Quotas (AWS-61) are best-effort, per serverless instance.

## Q&A appendix

Appendix, for Q&A only. Sources: US Census Bureau HVS Q2 2026 (46,827,000 renter-occupied units); Foundation for Community Association Research Statistical Review 2025; AirDNA US Review Dec 2025; Buildium 2026 report; PriceLabs 2025 Global Host Report via The Host Report (third-party). Links in /workspace/mmhack/gtm/RESEARCH.md.

Appendix, for Q&A only. Sources: propertymeld.com/pricing (MAX On-Call AI intake); Latchel; Angi Help Center and Thumbtack Help (pay per lead); FTC press release 2023 on HomeAdvisor. Links in /workspace/mmhack/gtm/RESEARCH.md.

## Backup video (90 s) shot list

Record at 1280x900 desktop plus one phone capture at 390 wide. URL: https://mmhack.vercel.app . Start each run from a fresh guest session. Keep the trace bar visible under each answer.

| Time | Shot | Screen / URL | What to show |
|---|---|---|---|
| 0:00-0:05 | Title | Deck slide 1 | QR code and mmhack.vercel.app |
| 0:05-0:12 | Guest login | Phone or desktop, mmhack.vercel.app | Login card with the mascot. Tap "Continue as guest". No signup |
| 0:12-0:20 | Photo in | Desktop home | Tap "Try the sample photo", or paste/drop a photo into the composer. Send "This is leaking. What do I do?" |
| 0:20-0:30 | It says what it sees | Desktop | "I see a single-handle pull-out kitchen faucet... Right?" Trace: Photo by gpt-5, Triaged by gpt-5-mini, Confirmed by gpt-5-mini, time and cost. Tap "Yes" |
| 0:30-0:42 | Plan + approval card | Desktop | Answer the 1-2 questions. Scroll the 5-step plan to the approval card. Pause on "Nothing is sent automatically" and the "Preview / export only" box (Swytchcode governed preview) |
| 0:42-0:48 | Why this model? | Desktop | Open the trace and click "Why this model?" on the plan step. Show ADR-002 open at /adr/ADR-002-model-routing.txt |
| 0:48-0:54 | Drawing | Desktop | The repair drawing, labeled "Pre-generated sample illustration, not live" for the sample photo. Trace: Plan by Sonnet 5, Checked by gpt-5-mini, Illustration by pre-generated |
| 0:54-1:02 | Approve | Desktop | Click Approve. "Ready to send" with the drafted request and record id. Guest preview: copy the draft (sign in and connect Gmail to send from your own address) |
| 1:02-1:14 | Safety stop + audit | Desktop, New chat | Tap "I smell gas near the stove." Show "Stop: this looks hazardous (gas)", no repair plan, "Safety by rules + triage". Click "Audit": Job audit trail with SYSTEM, AGENT, CODE rows and awaiting_approval |
| 1:14-1:22 | Base44 companion | https://simple-land-flow-fix.base44.app | Landlord Inbox companion app. Say it plainly: delivery from FixIt is not wired yet. Do not stage a request landing there |
| 1:22-1:30 | Close | Deck slide 10 | QR code, "Continue as guest. No signup." |

Notes for honesty on camera: since PR #13 the Audit drawer labels the store "Anbaric state model · signed job (cloud sync off)". Say exactly that if asked. Swytchcode is preview/export only on the live site.
