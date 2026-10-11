# Design system: the shelf

Reference: press.stripe.com (studied Oct 11 2026; refs in `shots/ref/`). What we took, and what we changed.

## From Stripe Press
| Stripe Press | mmhack |
|---|---|
| Home is a 3D stack of book spines on a dark warm field, seen slightly from above (top page-block visible) | Home (`/`) is a stack of **assistants as books**. Each has its own spine color, title, byline (the models it leans on) and type treatment |
| Scrolling fans the stack apart; books separate vertically | `useScroll` drives a sprung `spread` (2px to 64px gap) and a slight extra tilt (-6deg to -14deg) |
| Left index rail of hairline ticks | Same rail; active tick grows and turns accent |
| Tiny logo + serif italic tagline top-left | `MMHACK` wordmark + Newsreader italic "A shelf of assistants" |
| Mixed spine typography (serif italic, wide caps sans, grotesk) | `type: serif / sans / display` per assistant |
| Book pulls out on selection | Hover/focus: book slides toward the viewer (`z: 36`, `x: 10`). Click: `z: 120` in 280ms, then route to `/a/[slug]` |

## Our layers
1. **Canvas**: near-black `--background` (faint violet cast).
2. **Content color**: spine cloths (muted oklch, low chroma) + `cloth.png` linen texture. Spines are content, like covers; they are the only multi-color element.
3. **UI accent**: ONE, `--mm-accent` electric violet. Interactive only (links, primary button, focus ring, active tick, running state).
4. **Ribbed glass** (`.ribbed-glass`, `.ribbed-glass-h`): every floating surface (chat header, trace panel, composer, shelf caption card).
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
`--mm-accent*`, `--grain-opacity`, `--grain-size`, `--rib-width`, `--rib-light`, `--rib-dark`, `--glass-tint`, `--glass-blur`, `--shelf-perspective`, `--book-h`, `--book-depth`, `--ease-out`, `--ease-in-out`, `--dur-*`. Assistant spine colors live in `src/lib/assistants.ts`.

## Adding an assistant
Add an entry to `ASSISTANTS`: slug, title, author (byline), activity, blurb, spine, ink, type, system prompt, optional `prefer: "reason" | "fast"` (biases the router), starters. It appears on the shelf and gets `/a/<slug>` automatically.

## Assets
Textures are generated procedurally (`grain.png`, `cloth.png`). Image generation via the Neon gateway was skipped: its catalog lists gpt-5-5-pro as text output only, and procedural textures are smaller and tile perfectly.

## Book materials (v2, Oct 11)
- Textures generated with **gpt-6-astra** via the Neon gateway (`/openai/v1/responses`, image_generation tool, JPEG, medium): `linen`, `worn` (vintage bookcloth), `leather` (pebbled grain), `pages` (page-edge block). gpt-5-5-pro was tried once and timed out (504).
- Post-processing (`scripts` inline in commit history): grayscale, normalized to mid-gray, made seamless by blending with a half-offset copy, resized to 256 to 384px, WebP q68. Total about 130KB. `pages.webp` keeps a cream tint.
- Tinting: one grayscale texture serves every color via `background-blend-mode: overlay` over the spine color, so each book keeps its distinct cloth color.
- Per book (`material` + `foil` in `src/lib/assistants.ts`): leather (Router, Plain Style), linen (Code, Vision, Ops), worn cloth (Research, Voice).
- Spine details in CSS (`.book-spine`, `.book-band`, `.book-foil`, `.book-deboss`): rounded-spine shading, rubbed corners and edge wear (soft-light radial gradients), two embossed raised bands, gold-foil stamped titles or debossed titles.
- 3D: top face = cover board in the same material, darkening toward the back; right end face (`.book-end`) = page block between two board edges. The stack has a slight `rotateY(-14deg)` so the page ends show. Static textures only; no animated filters, so scrolling stays on the compositor. Reduced motion is unchanged (fixed tilt, no pull-out, static grain).
