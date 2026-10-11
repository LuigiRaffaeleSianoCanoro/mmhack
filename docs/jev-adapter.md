# Raw-Jev triage adapter (AWS-58): primary triage since Oct 11 2026

- Code: `src/lib/jev.ts`, wired in `src/app/api/fixit/route.ts`. SDK `@typesafe-ai/sdk@0.6.0`, `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest`.
- This is **raw TypeSafe Jev**, not OpenRouter's `typesafe/jev-router` (a model picker measured in JUSTIFICATION.md).
- **On whenever `TYPESAFE_API_KEY` is set** (server-only env). Set `FIXIT_JEV_TRIAGE=0` to turn it off; then gpt-5-mini triages exactly as before and no Jev step appears in the trace.
- Plain-language trace: "Triaged by Jev: ..." or, after a fallback, "Triaged by GPT-5 mini (backup for Jev): ...".
- Optional env: `TYPESAFE_MODEL` (default jev-latest), `TYPESAFE_TIMEOUT_MS` (default 2500, clamped 500-2500), retries disabled.

## Behaviour
| Jev result | What happens |
|---|---|
| Valid, confident | Trace shows the model id returned by the API, measured latency, decision, confidence, P(hazard); cost "unknown" |
| Timeout / HTTP error / auth error | Error row "Jev triage (fallback)", then gpt-5-mini triage |
| Malformed (fails zod schema) | Same fallback |
| P(hazard) ≥ 0.7 and hazard evidence in text | Hazard → safety stop (any confidence) |
| 0.3 ≤ P(hazard) < 0.7 | Unsure → gpt-5-mini decides |
| P(hazard) ≥ 0.7 but no hazard evidence in the text (`HAZARD_EVIDENCE`) | gpt-5-mini decides (fix for the sample photo "This is leaking", P 0.72) |
| P(hazard) < 0.3 and confidence < 0.6 | Same fallback (not trusted) |
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

## Production bench (Oct 11 2026, ~2:45 PM PT)
Run on mmhack.vercel.app with the production TYPESAFE_API_KEY via a temporary admin-token endpoint (removed). 14 cases (8 hazards: 2 gas, 2 electrical, 2 CO, 2 flooding; 6 benign), each 3 times. gpt-5-mini used the exact /api/fixit triage prompt. Raw data: `bake/jev_bench_2026-10-11.json`. API returned model id `jev-1.13.0`.

| | Jev (old 0.3 threshold) | gpt-5-mini |
|---|---|---|
| Hazard runs caught | 24/24 | 24/24 |
| Benign runs flagged as hazard | 6/18 (washer E21, blank thermostat; P 0.30-0.42) | 0/18 |
| Fallback (low confidence) | 6/42 (faucet drip, mouse droppings) | n/a |
| Category matches expected | 36/36 answered | 36/42 (CO alarm→hvac x3, dryer gas→appliance x2, hinge→structural x1) |
| Latency median / max | 128 / 200 ms | 962 / 1598 ms |

The 0.3-0.7 "unsure → gpt-5-mini" band was added after this bench, so the benign false positives now go to gpt-5-mini. Thresholds are in-sample; rerun `scripts/jev-bench.ts` on new cases before tightening them.

## Hazard-evidence gate (Oct 11, ~3:50 PM PT)
- Production repro: sample photo + "This is leaking. What do I do?" → Jev P(hazard) 0.72, confidence 0.49-0.56 → safety stop. Jev only sees the text and a `photo_attached` boolean; gpt-5 vision and the `HAZARD` keyword stop were not involved.
- `HAZARD_EVIDENCE` (in `src/lib/jev.ts`) is NOT the stop list. `HAZARD` (route.ts) stops immediately with no model. `HAZARD_EVIDENCE` only decides whether Jev's P ≥ 0.7 may stand; it is deliberately broader (warm, outlet, ceiling, pour, alarm, detector) because a miss there only hands the decision to gpt-5-mini, it never drops a hazard. Update both when the hazard taxonomy changes.
- gpt-5-mini is the explicit backstop for every Jev fallback (unsure, low confidence, no evidence, error, timeout). Re-bench gpt-5-mini if its model version changes.
