# mmhack (placeholder name)

Multi-model chatbot scaffold for the Multi Model Hackathon #SFTechWeek. One chat, many models, and every routing decision is visible in the **Routing trace** panel (task, model, why, latency, cost, status), with a human-approval gate for side-effect requests.

## UI
`/` is a 3D shelf (after press.stripe.com): each assistant is a book. Click one to open its chat at `/a/<slug>`. Heavy film grain and ribbed glass across the system. See docs/brand/DESIGN.md.

## Stack
Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (base-nova) + Vercel AI SDK v7 + motion. pnpm.

## Run
```bash
cp .env.example .env.local   # fill in values
pnpm install && pnpm dev
```

## How routing works (`src/lib/router.ts`)
| Signal | Model | Provider |
|---|---|---|
| audio attached | gemini-3-flash | Neon AI Gateway (`$NEON_AI_GATEWAY_BASE_URL/v1`) |
| image attached | gpt-5-4-mini | Neon AI Gateway |
| reasoning / code intent or >600 chars | claude-sonnet-5-5 | Anthropic direct |
| everything else | gemini-3-1-flash-lite | Neon AI Gateway |
| "send / delete / pay / deploy ..." | human approval card first | |

`/api/chat` streams a UI message stream: text deltas plus `data-trace` and `data-approval` parts (reconciled by id so steps update in place).

Gateway quirks handled in a custom fetch: Gemini rejects `stream_options`, and audio must be sent as `audio_url` data URLs. Browser-recorded webm audio is not supported by the AI SDK OpenAI provider (wav/mp3 only).

## Agent workflow: pstack
Lauren Tan's (poteto) pstack is vendored in `.cursor/skills` + `.cursor/agents` (from cursor/plugins, pstack 0.15.17). In Cursor: `/setup-pstack` once, then `/poteto-mode` for any rigorous task. Or install the plugin globally with `/add-plugin pstack`.

## Brand
docs/brand/BRAND.md and docs/brand/MOTION.md.
