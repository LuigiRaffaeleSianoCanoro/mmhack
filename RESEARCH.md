# Multi Model Hackathon #SFTechWeek — Research (compiled Sun Oct 11 2026, ~9:30 AM PT)

## Event facts (sources: luma.com/builde-pozq, builderbase.com event page)
- Frontier Tower, 995 Market St SF. Hosts on Luma: Sean Chiu, Jessie Hsu. Free; Luma approval required.
- BuilderBase schema: 2026-10-11 15:00Z–03:00Z (8 AM–8 PM PT). Code freeze 5:30 PM / 4-min live demos / awards 8 PM (from brief, not re-verified).
- Challenge: product more useful because it combines >1 model/provider/agent/modality; routing by modality, speed, cost; real-person use; show why one model isn't enough.
- **Prizes, judges, rules, credits: NOT PUBLISHED.** BuilderBase page body didn't render (JS); aggregator (ushackathons/aisocratic) says prizes and judges "TBD". No per-sponsor prizes found. No Discord/Notion found. → ASK ORGANIZERS IN ROOM (prize categories, judging rubric, sponsor credits, Jev keys).
- Also listed: Partiful page (partiful.com/e/NIH9QXWiUeGC15wJLKkF), AI Socratic listing.

## Jev (TypeSafe AI) — "System One model"
- Classification/decision model: you give `state` text + typed `questions` (Choice ≤255 options, Score ≤10 levels, Noul/yes-no-ish); returns choice + calibrated probabilities + confidence. No prose generation. Reported 70–500 ms latency.
- Released 15 Sep 2026, early access. Endpoint `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`. SDKs: Python `typesafe-sdk`, TS `@typesafe-ai/sdk` (reads TYPESAFE_API_KEY).
- Also on OpenRouter as `typesafe/jev-1.13` / `~typesafe/jev-latest`, $0.042/M input, free output, 64k ctx (per systemonemodels.org — third-party site, verify).
- Pattern: Jev picks tool/model (with "none"/"ask_user" options), LLM fills arguments; low confidence → escalate to human or full LLM. PERFECT router for this track.
- Access: UNKNOWN whether sponsors give keys today; fastest path = OpenRouter key, or ask organizers (event copy names Jev explicitly — likely Actual AI/organizer tie-in, unverified).

## Sponsors
### Anbaric (anbaric.ai, London; 4 people)
- Workflows of HUMAN / AGENT / CODE actors; every change audited with actor identity. "Last mile for vibe coding": deploys apps with auth, audit trail, hosting.
- npm: `anbaric-state-machine`, `anbaric-tsapi`, `anbaric-services-client`. Concepts: Job (immutable), State, Action(name, actor, run), Transition, JobPersistence w/ Auditor, Queue/Consumer. `OpenAIAgent` agent actor.
- Anbaric MCP server + Claude Code path mentioned on site. Free tier/credits: UNKNOWN.
- Integrate in hours: model our pipeline as an Anbaric StateMachine (Human approval step = Human actor), show audit log in UI.
### Base44 (no-code AI app builder, Wix-owned)
- `@base44/sdk` `createClient({appId})` lets external apps use Base44 entities as a backend. Free plan exists; backend functions/connectors need Builder plan+.
- Integrate: build the judge-facing landing/feedback/leaderboard or "approver console" in Base44 in ~30 min, writing/reading entities via SDK from our app.
### Actual AI (actual.ai) — co-host
- Architecture Agent: generates/maintains ADRs from codebase, writes routing block in CLAUDE.md/AGENTS.md, architecture review on PRs. Architecture Advisor MCP. CLI: `npx @actualai/actual` (Homebrew too). Pricing/free: UNKNOWN.
- Integrate: run CLI on our repo, commit ADRs (e.g. ADR-001 "Jev routes, LLMs generate", ADR-002 model-per-task), show them in the demo; the router table literally IS an ADR.
### Prelint (prelint.com)
- GitHub App; 20-second "decision review" on every PR vs specs/ADRs/prelint.json; inline comments; auto-approve if clean; decision ledger (who/when/human vs AI); MCP server + CLI. Works with zero config. `@prelint` comment triggers review.
- Integrate: install app on repo, open PRs all day; ADRs from Actual feed Prelint. Show a PR where Prelint caught a routing-rule violation.
### Swytchcode (docs.swytchcode.com)
- CLI `swy` + MCP server governing agent API calls to (legacy) APIs: `swytchcode_discover/info/exec`, `tooling.json` allow-list, `policies.json` guard policies, `exec` supports `dry_run`/`demo`/`explain`. HTTP transport: `swy mcp serve --transport http --port 5476`. API catalog at swytchcode.com/apis. Pricing: UNKNOWN.
- Integrate: every external action (e.g. send email/SMS, create calendar event, Stripe/Twilio call) goes through `swy exec` with dry_run preview → human approves → real exec. Governance visible in trace.
### Community: Women in AI, AI Collective — no prizes found.

## Judges: NOT LISTED anywhere found. Ask on site.

## Available models (ours)
- Neon AI Gateway (OpenAI-compatible, /workspace/neon-gateway.env): gpt-5, gpt-5-mini, grok-4-6, gpt-6-astra, gpt-5-5-pro image gen (/openai/v1/responses).
- Anthropic: claude-opus-5-5, claude-sonnet-5-5.
- Sponsor-provided models: Anbaric bundles LLMs in its framework ("no API credits needed" — terms unknown); Jev (TypeSafe) via API/OpenRouter. Voice (STT/TTS) not confirmed in our gateway → use browser Web Speech API as fallback (free, zero setup).
