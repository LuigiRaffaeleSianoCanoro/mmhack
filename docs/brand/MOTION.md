# Motion (after Emil Kowalski)

Sources: emilkowal.ski/skill, github.com/emilkowalski/skills (emil-design-eng, animate, review-animations), animations.dev. Install the skills for agents: `npx skills add emilkowalski/skill`.

## The decision order
1. **Should it animate at all?** Frequency gate: actions a user does hundreds of times a day (typing, sending with Enter, keyboard shortcuts) get no or near-zero motion. Rare, meaningful moments (approval card appearing, a new trace step) earn motion.
2. **Purpose.** Every animation must explain something: where an element came from, what changed, what is in progress. "Looks cool" is not a purpose.
3. **Easing.** Custom curves, never built-in `ease-in` for UI. Enter/exit: `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`. On-screen movement: `--ease-in-out` `cubic-bezier(0.77, 0, 0.175, 1)`.
4. **Duration.** UI motion stays under 300ms. Tokens: `--dur-fast` 150ms (hover, press), `--dur-base` 220ms (enter), `--dur-slow` 320ms (sheets/drawers only). Exits faster than enters.
5. **Properties.** Animate `transform` and `opacity` only. Never animate from `scale(0)`; start at 0.95 to 0.98 plus opacity. Small y offsets (4 to 8px).
6. **Interruptibility.** Prefer CSS transitions (interruptible) for state changes; keyframes only for one-shot. Springs for gesture-driven motion (drag, swipe sheets).
7. **Origin awareness.** Popovers and dropdowns scale from their trigger (`transform-origin`), modals from center.
9. **Accessibility.** `prefers-reduced-motion: reduce` removes movement (global CSS kill switch in globals.css, plus `useReducedMotion()` in motion components to skip `initial`). Gate hover effects behind `@media (hover: hover)`.

## Where mmhack uses motion
| Element | Motion | Why |
|---|---|---|
| New message | opacity 0 to 1, y 6px to 0, 200ms ease-out | Shows where new content entered |
| Trace step | opacity + x 8px to 0, layout animation on status change | Ties each step to the panel, makes routing feel live |
| Running step | accent border + spinner icon | Progress without movement noise |
| Approval card | opacity + y 6px + scale 0.98 to 1, 220ms | A rare, important interruption deserves a beat |
| Buttons | 1px press translate (shadcn default) | Tactile, essentially free |
| Grain | steps(6) transform jitter, 0.9s loop | Film texture; compositor-only. Off under reduced motion |
| Typing / send | none | High frequency, must feel instant |

## Review checklist
- [ ] Under 300ms? Custom ease-out? No ease-in?
- [ ] Only transform/opacity?
- [ ] Does it survive reduced motion?
- [ ] Would a power user be annoyed by it the 100th time?
