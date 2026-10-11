# ADR-001: Routed multi-model pipeline

- Status: Accepted (2026-10-11)
- Evidence: JUSTIFICATION.md "One model isn't enough"; bake/summary.json

## Context
FixIt does triage, photo inspection, plan writing, safety cross-check and image generation. No single model wins every step.

## Decision
`/api/fixit` routes each step to its own model (see ADR-002). Every step emits a `TraceStep` with model, provider, why, measured latency and cost (cost only when token usage is known).

## Consequences
- Measured: routed ≈ $0.009 / ~13s vs an all-Opus pipeline ≈ $0.038 / ~22s, with equal or better judge scores per step, and Opus cannot generate images.
- Sample sizes are tiny (n=3–5, image n=1): directional, not significant.
