# Design system: FixIt

FixIt is the only product. The bookshelf picker was removed on Oct 11 2026.

## Our layers
1. **Canvas**: near-black `--background` (faint violet cast).
3. **UI accent**: ONE, `--mm-accent` electric violet. Interactive only (links, primary button, focus ring, active tick, running state).
5. **Heavy grain** (`.grain-overlay`): one fixed layer over everything, mounted once in `layout.tsx`.

## Heavy-grain web experiences
- Pre-rendered 160px grayscale noise tile (`public/textures/grain.png`, 25KB) instead of a live SVG `feTurbulence` filter: no per-frame filter cost, no repaint of content.
- `mix-blend-mode: overlay`, `--grain-opacity: 0.11`. Strong enough to read as film, never enough to hurt text contrast.
- "Alive" grain: the layer jitters with `steps(6)` over 0.9s via `transform` only (compositor-only, `will-change: transform`). Disabled under `prefers-reduced-motion`.
- The overlay is `inset: -50%` so translation never reveals edges, and `pointer-events: none`.

## Ribbed glass and linear refraction
- Frost: `backdrop-filter: blur(var(--glass-blur)) saturate(1.2)` over `--glass-tint`.
- Flutes: `::before` is a `repeating-linear-gradient(90deg, light edge, clear, dark trough, light edge)` every `--rib-width` (6px), blended with `overlay`. This reads as vertical reeded glass.
- Refraction streak: `::after` is a single diagonal highlight that suggests light bending across the reeds.
- Horizontal variant `.ribbed-glass-h` for wide, short bars.
- Upgrade path (not shipped, perf cost): SVG `feDisplacementMap` driven by a stripe gradient, or a WebGL pass that offsets the backdrop by `sin(x / rib)` per flute for true linear refraction. Keep the CSS version as the fallback.

## Tokens (src/app/globals.css)


## FixIt surface (Oct 11)
- **Backdrop**: brick wall with a broken bottom-right corner (missing bricks, exposed pipe, small leak). gpt-6-astra wrote 3 art-direction prompts, then gpt-6-astra and gpt-5-5-pro rendered them (gpt-image-2 returned 400). gpt-6-astra judged the candidates against the criteria and picked `gpt-6-astra-p1` (9.0). Candidates are in `shots/bg-candidates/`. The image is desaturated to 60% and shipped as WebP at 960 and 1600px (16KB and 48KB) with a radial vignette (`.brick-bg`). The chat column sits on a near-opaque `bg-background/88` panel, so text contrast is the same as on plain near-black (AA). `--muted-foreground` was raised to L 0.72.
- **Wizard**: confirm (gpt-5-mini) with chips, then 1-2 clarifying questions with chips, then a short plan (claude-sonnet-5 via the Neon AI Gateway, router retry on gpt-5) with a "Show details" expander, then the landlord-draft approval. Every message is 1-3 sentences, in the user's language. Hazard words trigger the safety stop immediately on any turn.
- **Inline trace**: there is no trace column. Each assistant turn gets a slim glass alert ("Triaged by gpt-5-mini · Photo by gpt-5 · ..."), which expands to show why each model ran. Icon buttons show latency, cost, provider and why, as tooltips on hover/focus and as inline text on tap (mobile). Errors and fallbacks show as an amber chip with the reason in a tooltip. The session cost total is in the header.
- **Sessions**: a left sidebar (a drawer on mobile, collapsible on desktop) with New chat and history. Sessions are stored in localStorage (`fixit.sessions.v1`) and titled from the first message.
