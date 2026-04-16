# AGENTS.md

## Project Structure
- `packages/core`: Shared heuristics and schemas - critical for understanding tool-fitness ranking
- `apps/web`: Vercel Next.js app (operator console)
- `workers/mcp`: Cloudflare Worker MCP server

## Development Setup
- `pnpm install`: Install dependencies
- `pnpm dev:web`: Start web UI (must run first)
- `pnpm dev:mcp`: Start MCP server (use `https://localhost:8080/mcp`)
- `NEXT_PUBLIC_MCP_SERVER_URL`: Set this to your MCP server URL after deployment

## Environment Requirements
- `AI_GATEWAY_API_KEY`: Required for local narrative briefing
- `AI_GATEWAY_MODEL`: Optional override (default: `anthropic/claude-sonnet-4.6`)
- `NEXT_PUBLIC_MCP_SERVER_URL`: Must be set after MCP server deployment

## Deployment
- **Vercel (Web)**:
  1. Import `apps/web` as project root
  2. Add environment variables
  3. Deploy preview, then promote
- **Cloudflare MCP**:
  1. `pnpm --filter mcp deploy`
  2. Use resulting URL as `NEXT_PUBLIC_MCP_SERVER_URL`

## Validation
- `pnpm --filter @tool-dissonance/core test` (core heuristics)
- `pnpm --filter mcp test` (MCP server)
- `pnpm --filter web lint` (web app)
- `pnpm build` (full build)

## Skills
- `skills/`: Demonstration skills showcasing LidLift's tool-dissonance analysis
- `skills/gh-repo-clone/`: Example skill for `gh repo clone` tool-fit analysis
- `skills/catalog.json`: Skill index with metadata and evaluation info
