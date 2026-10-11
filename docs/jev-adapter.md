# Optional raw-Jev triage adapter (AWS-58)

- Code: `src/lib/jev.ts`, wired in `src/app/api/fixit/route.ts`. SDK `@typesafe-ai/sdk@0.6.0`, `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`.
- This is **raw TypeSafe Jev**, not OpenRouter's `typesafe/jev-router` (a model picker measured in JUSTIFICATION.md).
- **Off by default.** Enabled only when `FIXIT_JEV_TRIAGE=1` and `TYPESAFE_API_KEY` are set (server-only env). Otherwise gpt-5-mini triages exactly as before and no Jev step appears in the trace.
- Optional env: `TYPESAFE_MODEL` (default jev-latest), `TYPESAFE_TIMEOUT_MS` (default 2500), retries disabled.

## Behaviour
| Jev result | What happens |
|---|---|
| Valid, confident | Trace shows the model id returned by the API, measured latency, decision, confidence, P(hazard); cost "unknown" |
| Timeout / HTTP error / auth error | Error row "Jev triage (fallback)", then gpt-5-mini triage |
| Malformed (fails zod schema) | Same fallback |
| Confidence < 0.6 and P(hazard) < 0.3 | Same fallback (not trusted) |
| Low confidence but P(hazard) ≥ 0.3 | Treated as hazard → safety stop (conservative) |
| Any path | `HAZARD` keyword rules on the text still apply; new: the same rules run on vision output, so a photo-only hazard also stops DIY planning |

## Evidence (Oct 11 2026, ~11:20 AM PT, local mock server via TYPESAFE_BASE_URL)
```
ok:             OK model=jev-mock latencyMs=45 confidence=0.9 hazardP=0.97 → gas/emergency/hazard
slow:           FALLBACK APITimeoutError: Request timed out after 1000ms.
malformed:      FALLBACK malformed Jev output
lowconf:        FALLBACK low confidence 0.30 after 51 ms
lowconf-hazard: OK hazard=true (P=0.8) → safety stop
real API, invalid key: FALLBACK AuthenticationError: 401
```

## Not yet measured
No TypeSafe API key exists yet, so raw Jev has **not** been benchmarked. Create a key at console.typesafe.ai (magic-link login), set it in Vercel/`.env.local`, then run:
`TYPESAFE_API_KEY=... npx tsx scripts/jev-bench.ts` → `bake/jev_raw.json` (5 bake TRIAGE cases: decisions, model id, latency, usage). Only enable the flag in production if it scores ≥ gpt-5-mini (4/5, all gas/electrical stops caught).
