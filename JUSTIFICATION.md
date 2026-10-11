# FixIt: model and sponsor justification (measured Sun Oct 11 2026, ~9:45–10:05 AM PT)

Raw data: bake/raw.json, grok_rerun.json, scores.json, img2.json, img_scores.json, gen_*.jpg. Scripts: bake/bake.py, judge.py, ijudge.py, img.py (to re-run for a different idea, change TRIAGE/PHOTOS/PLANS/XC in bake.py).

## Method
- **Same inputs for every model.**
  - Triage: 5 text cases (dripping faucet, water-heater leak, gas smell, scorched outlet, washer E21), each labelled by me with a category and a safety-stop yes/no.
  - Vision: 3 real Wikimedia Commons photos (Franke faucet drip, "Water Heater Leak (54127737098)", "Outlet (5605095046)").
  - Plans: 3 of the problems above.
  - Cross-check: 3 plans with a deliberately planted dangerous error.
  - Image: 1 prompt (a faucet-cartridge diagram).
- **Quality scoring.** Triage was scored automatically against my labels. Vision, plan and image were scored blind (answers shuffled and anonymized) by gemini-3-1-pro, which is not one of the competing models, on a 1–10 rubric. Cross-check counted whether the planted error was flagged.
- **Latency** is the median wall-clock time per call, from this box through Neon or Anthropic.
- **Cost** is measured token usage × published price. Prices come from the Neon gateway `/v1/models` pricing field and, for claude-sonnet-5-5 ($2/$10 per M tokens), from platform.claude.com/docs/en/models/sonnet-5-5/overview.
- **Caps:** max_tokens was 300 (triage), 400 (cross-check), 600 (vision), 900 (plan); the GPT reasoning models got 3x those.
- Sample sizes are tiny (n=3–5, image n=1), so this is directional, not statistically significant.

## Results (quality · median latency · avg $/call)
| Task | gpt-5 | gpt-5-mini | grok-4-6 | gpt-6-astra | opus-5-5 | sonnet-5-5 | Jev |
|---|---|---|---|---|---|---|---|
| Triage (correct/5) | 4 · 1.5s · $0.00037 | 4 · 1.7s · $0.00007 | 0 at 300-token cap (empty output); **4 · 5.6s at 3000 cap** | 4 · 2.3s · $0.0034 | 4 · 2.3s · $0.0029 (1 empty, hit cap) | **5 · 1.2s · $0.00052** | via jev-router: 4 · 1.7s (0.63–0.74s on gas/electrical) · $ not shown |
| Vision (/10) | 8.0 · 3.6s · $0.0025 | 7.3 · 1.9s · $0.0005 | 3.0 · 9.6s · $0.0051 | 8.0 · 4.3s · $0.0167 | **8.3** · 6.9s · $0.0132 | 7.7 · 3.3s · $0.0049 | n/a |
| Plan (/10) | 6.7 · 4.0s · $0.0039 | 5.3 · 3.4s · $0.0007 | 3.7 · 13.3s · $0.0055 | **9.0** · 9.5s · $0.0200 | 7.0 · 8.6s · $0.0151 | 8.7 · 5.7s · $0.0061 | n/a |
| Cross-check (caught/3) | 3 · 2.0s · $0.0014 | 3 · 1.9s · $0.0003 | 3 at 3000 cap, 10.7s | 3 · 3.3s · $0.0057 | 3 in text (2 cut off at 400 tokens) · 4.6s · $0.0071 | 3 · 2.6s · $0.0027 | n/a |
| Image (/10, n=1) | 10 · 34.7s | 9 · 25.6s | no image output | **10 · 24.9s** | no image output | no image output | n/a |

Notes on the results:
- **Triage miss:** every model except Sonnet "missed" the water-heater case only because it set safety_stop=true where I labelled false. That label is debatable, and this is my scoring, not the judge's. All models got gas and electrical right.
- **Missing judge scores:** where a model returned empty or truncated text it was scored 0. Grok (vision/plan) and Opus (plan) hit their caps.
- **Image cost:** the images were generated through the gateway's `/openai/v1/responses` image_generation tool (quality=low, jpeg). The first attempt failed: the PNG output was larger than the gateway's 655 KB response limit, and gpt-5-5-pro timed out (504). With jpeg it worked. Only the text tokens were reported (gpt-6-astra 2026 in / 403 out). The **image-generation charge itself was not measured.** gpt-5-5-pro also scored 10 (29.6s).

## Winners
- **Triage → gpt-5-mini.** It caught every gas/electrical safety stop at about 1/7 of Sonnet's cost ($0.00007 vs $0.00052). If accuracy on edge cases matters more than cost, use Sonnet: it was the only model with 5/5, at 1.2s.
- **Photo understanding → gpt-5.** It scored 8.0 vs Opus's 8.3 (96%) at 1/5 the cost and 2x faster.
- **Fix plan → claude-sonnet-5-5.** It scored 8.7 vs gpt-6-astra's 9.0 (96%) at 1/3 the cost and 1.7x faster. Escalate to gpt-6-astra only for high-urgency cases.
- **Cross-check → gpt-5-mini.** Every model caught all 3 planted errors, and this one was cheapest and fastest. It's also a different provider from the plan writer (Anthropic), so the check is independent.
- **Image → gpt-6-astra.** Top score and fastest of the image-capable models (n=1, image cost unknown).
- **Cut: grok-4-6.** It didn't win any task: 3–10x slower, and it fails at the token caps used for everyone else. It only scores well with a much larger budget. Drop it from the router; that also removes the old "Grok second opinion" idea.
- **Jev:** a raw `jev-latest` key was NOT available. OpenRouter only lists `typesafe/jev-router`, a model-picker built on Jev that sent our calls to openai/gpt-6-luna and deepseek/deepseek-v4.1-flash, with pricing listed as "-1" (variable/not shown). Raw Jev (70–500 ms, calibrated probabilities) is **unmeasured**. If organizers hand out a TypeSafe key, put it in front as the router and safety gate, and benchmark it with bake.py's TRIAGE set.
- **Excluded from tasks:** Opus, Sonnet and Grok can't generate images in this setup, so they're not in the image comparison. Voice wasn't tested; I couldn't confirm speech-to-text on the gateway.

## One model isn't enough (computed from the measured numbers above)
- A plausible all-Opus pipeline would be triage + vision + plan + check = $0.0029 + $0.0132 + $0.0151 + $0.0071 ≈ **$0.038 and ~22s**. It also can't produce the image.
- The routed pipeline: $0.00007 + $0.0025 + $0.0061 + $0.0003 ≈ **$0.009 and ~13s**, plus the image. About 4x cheaper, with equal or better judge scores on each step.

## Sponsors (see justification_sponsors.png)
| Sponsor | Problem only it solves here | Without it | On screen |
|---|---|---|---|
| Anbaric | One audited job with HUMAN/AGENT/CODE steps: who approved the landlord request | Approval is a button with no record of who approved what | "Audit" drawer timeline |
| Swytchcode | Outbound API calls restricted to an allow-list, with a dry-run before the human approves | The agent could call any API with no guard | Approval card shows the dry-run, then "Exec ✓" |
| Actual AI | The router table is ADR-002, read by the coding agents | Routing drifts while building with agents | "Why this model?" link opens the ADR |
| Prelint | PRs checked against the ADRs (e.g. "no direct API calls, only Swytchcode") | Violations get merged | "Built with" slide showing a Prelint PR comment |
| Base44 | Landlord-side inbox that receives the request | Only a mock confirmation | Second screen |

- **Base44 feels FORCED.** Cut it unless a Base44 prize is confirmed on site; if it stays, keep it to under 30 minutes of work.
- **Actual AI and Prelint are build-process tools**, not features judges use. They're justified because they enforce the routing and safety decisions, but they're only visible in the "Built with" moment. Be upfront about that in the demo.
- **Swytchcode:** check its API catalog (swytchcode.com/apis) for an email/SMS provider before committing.
