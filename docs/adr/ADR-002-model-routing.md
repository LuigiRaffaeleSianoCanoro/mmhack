# ADR-002: Model routing table

- Status: Accepted (2026-10-11)
- Source of truth in code: `src/app/api/fixit/route.ts` (FixIt pipeline). `src/lib/router.ts` is the older generic shelf router and is not the FixIt policy.
- Evidence: JUSTIFICATION.md (measured Oct 11 ~9:45–10:05 AM PT), bake/summary.json, bake/scores.json, bake/img_scores.json

## Decision
| Step | Model | Provider | Measured (quality · median latency · $/call) | Why |
|---|---|---|---|---|
| Triage | gpt-5-mini | Neon AI Gateway | 4/5 · 1.7s · $0.00007 | Caught every gas/electrical safety stop at ~1/7 of Sonnet's cost. Sonnet (5/5, 1.2s, $0.00052) is the accuracy alternative. |
| Vision | gpt-5 | Neon AI Gateway | 8.0/10 · 3.6s · $0.0025 | 96% of Opus (8.3) at 1/5 the cost, 2x faster. |
| Plan | claude-sonnet-5-5 | Anthropic | 8.7/10 · 5.7s · $0.0061 | 96% of gpt-6-astra (9.0) at 1/3 the cost, 1.7x faster. Escalate to gpt-6-astra only for high urgency. |
| Cross-check | gpt-5-mini | Neon AI Gateway | 3/3 caught · 1.9s · $0.0003 | All models caught all planted errors; cheapest, fastest, and a different provider than the plan writer. |
| Image | gpt-6-astra | Neon AI Gateway | 10/10 · 24.9s (n=1, image charge unmeasured) | Top score, fastest image-capable model. |

## Rejected / optional
- **Grok (grok-4-6): removed.** Won no task; 3–10x slower; empty output at the shared token caps. No "Grok second opinion".
- **Opus is not a default** for any step (higher cost, hit caps on plan).
- **Jev (TypeSafe `jev-latest`): optional, unmeasured.** Only OpenRouter's `typesafe/jev-router` (a model picker that forwarded to other models, pricing not shown) was measured: 4/5, 1.7s. Raw Jev latency is NOT claimed until benchmarked on the bake TRIAGE set. If added, it sits behind a flag with gpt-5-mini fallback, and keyword hazard rules still apply.

## Rules for agents and reviewers
1. Changing a step's model requires updating this ADR with new bake evidence.
2. Do not reintroduce Grok or make Opus a default without new measurements.
3. Do not state Jev latency/cost as fact without a measured run.
4. Hazard keyword rules (`HAZARD` regex) run regardless of which triage model answered.
