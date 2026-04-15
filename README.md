# LidLift

LidLift is a launch-ready tool-dissonance product for MCP stacks. It scores prompt-to-tool fit before execution, turns that score into an explicit guardrail decision, ranks safer alternatives, and exposes the same analysis engine through a remote MCP server.

## Stack

- `apps/web`: Next.js App Router operator console for Vercel
- `workers/mcp`: Cloudflare Worker exposing remote MCP tools on `/mcp`
- `packages/core`: shared heuristics, schemas, and sample catalog
- `OpenAI Responses API`: optional narrative briefing layer for the web API

## What ships

- Interactive console with live preview, ranked results, and explicit `allow` / `review` / `clarify` / `block` gates
- `POST /api/analyze` for deterministic ranking plus optional OpenAI narrative output
- `GET /api/health` for web readiness checks
- `POST /mcp` for remote MCP transport on Cloudflare Workers
- Shared Zod-backed schemas so the browser, API layer, and MCP worker stay aligned

## Local development

```bash
pnpm install
pnpm dev:web
pnpm dev:mcp
```

Open the web app from the URL printed by Next.js. The Worker runs locally through Wrangler.

## Environment

Web app:

- Copy [apps/web/.env.example](/Users/igorholt/LidLift MCP/apps/web/.env.example:1)
- Set `OPENAI_API_KEY` to enable operator brief generation
- Override `OPENAI_MODEL` if you do not want the default `gpt-5.4-mini`
- Set `NEXT_PUBLIC_MCP_SERVER_URL` after deploying the Cloudflare Worker

Worker:

- No secrets are required for the public analyzer
- Optional local vars can go in [workers/mcp/.dev.vars.example](/Users/igorholt/LidLift MCP/workers/mcp/.dev.vars.example:1) once you extend the Worker with auth or upstream APIs

## Deploy

### Web on Vercel

1. Import `apps/web` as the project root.
2. Add `OPENAI_API_KEY`, `OPENAI_MODEL`, and `NEXT_PUBLIC_MCP_SERVER_URL`.
3. Deploy preview, then promote to production.

### MCP server on Cloudflare

1. Deploy from `workers/mcp`.
2. Publish with `pnpm --filter mcp deploy`.
3. The production MCP endpoint is `https://api.optimizationinversion.com/mcp`.

## Validation

These commands are already passing in this workspace:

```bash
pnpm --filter @tool-dissonance/core test
pnpm --filter mcp test
pnpm --filter web lint
pnpm build
```
