# mmhack brand (placeholder name)

Source of truth for the UI. Every value maps to a CSS custom property in `src/app/globals.css`. Components consume tokens (Tailwind classes like `bg-background`, `text-mm-accent`, `border-border`). No raw hex in components.

## Principles
- Near-black canvas, ONE strong accent, everything else neutral. Linear-grade restraint: if it is not information, remove it.
- Bold condensed display headings, quiet body.
- Logo small, top-left in the header. Never a hero logo.
- Motion is purposeful only (see MOTION.md). Respect `prefers-reduced-motion`.
- shadcn/ui (base-nova style, Base UI primitives) for all components. One token system, dark only.

## Color
| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.13 0.004 285)` | App canvas (near-black, faint violet cast) |
| `--card` / `--sidebar` | `oklch(0.17 / 0.15 ...)` | Raised surfaces, trace panel |
| `--foreground` | `oklch(0.96 0.003 285)` | Primary text |
| `--muted-foreground` | `oklch(0.66 0.01 285)` | Secondary text, metadata |
| `--border` | `white / 8%` | Hairlines |
| **`--mm-accent`** | **`oklch(0.68 0.24 293)`** (electric violet, about `#9D6BFF`) | The one accent: primary buttons, focus ring, running state, wordmark half, index numbers |
| `--mm-accent-soft` | accent at 14% | Selection, approval card wash |
| `--mm-ok` / `--mm-warn` / `--destructive` | green / amber / red | Status icons ONLY, never decoration |

Accent choice: electric violet, distinct from Albert AI orange and Luigi's personal green. To rebrand, change `--mm-accent*` only.

## Type
- Display: **Oswald** 500 to 700, uppercase, tracking `0.12em` to `0.2em` for labels, tight for hero (`font-display`).
- Body: **Inter** (`font-sans`), 15px chat text, 1.6 line height.
- Mono: system mono for numbers (latency, cost, model ids). Indices use leading zeros: 01, 02.

## Wordmark
`MM` in foreground + `HACK` in accent, Oswald bold, uppercase, tracking `0.2em`, 14px, header only.

## Voice
Direct, technical, calm. Show the mechanism ("Picked gemini-3-1-flash-lite: short prompt, cheapest model wins"), not adjectives. No em dashes. Never invent metrics.

## Layout
- Desktop: chat column (max 672px) + 380px right "Routing trace" panel.
- Mobile: trace moves into a right Sheet opened from the header "Trace" button.
