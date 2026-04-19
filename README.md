# LidLift

LidLift is a launch-ready tool-dissonance product for MCP stacks. It scores prompt-to-tool fit before execution, turns that score into an explicit guardrail decision, ranks safer alternatives, and exposes the same analysis engine through a remote MCP server.

## Live URLs

- Web console: `https://lidlift.optimizationinversion.com`
- API health: `https://api.optimizationinversion.com/health`
- MCP endpoint: `https://api.optimizationinversion.com/mcp`
- GitHub: `https://github.com/igor-holt/lidlift-mcp`

## Stack

- `apps/web`: Next.js App Router operator console for Vercel
- `workers/mcp`: Cloudflare Worker exposing remote MCP tools on `/mcp`
- `packages/core`: shared heuristics, schemas, and sample catalog
- `Vercel AI SDK + AI Gateway`: optional narrative briefing layer for the web API

## What ships

- Interactive console with live preview, ranked results, and explicit `allow` / `review` / `clarify` / `block` gates
- `GET|POST /api/discover-tools` for vendor-native tool discovery with cache control, force refresh, and vendor auto-detection
- `POST /api/analyze` for deterministic ranking plus optional AI Gateway narrative output
- `GET /api/health` for web readiness checks
- `GET|POST /discover-tools` plus `POST /mcp` for remote MCP transport on Cloudflare Workers
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
- Set `AI_GATEWAY_API_KEY` for local operator brief generation
- Override `AI_GATEWAY_MODEL` if you do not want the default `anthropic/claude-sonnet-4.6`
- Set `NEXT_PUBLIC_MCP_SERVER_URL` after deploying the Cloudflare Worker
- Set `LIDLIFT_DISCOVERY_CACHE_TTL_SECONDS` to tune vendor discovery cache lifetime. Default: `600`
- Optional vendor discovery keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`

Worker:

- No secrets are required for the public analyzer
- Set `LIDLIFT_DISCOVERY_CACHE_TTL_SECONDS` to tune discovery cache lifetime. Default: `600`
- Optional vendor discovery keys can be configured as Worker secrets with the same names: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `GEMINI_API_KEY`
- Optional production KV cache: bind `DISCOVERY_CACHE` in `wrangler.jsonc` and the Worker will persist discovery cache entries in KV instead of process memory
- Optional local vars can go in [workers/mcp/.dev.vars.example](/Users/igorholt/LidLift MCP/workers/mcp/.dev.vars.example:1) once you extend the Worker with auth or upstream APIs

## Vendor discovery

LidLift can now discover a vendor's built-in tool surface without a hand-authored tool catalog.

### HTTP discovery

```bash
curl "https://api.optimizationinversion.com/discover-tools?vendor=openai&model=gpt-5" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

```bash
curl "https://lidlift.optimizationinversion.com/api/discover-tools?model=gpt-5" \
  -H "X-Vendor: openai" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

```bash
curl "https://lidlift.optimizationinversion.com/api/discover-tools" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "anthropic",
    "model": "claude-sonnet-4-5",
    "auth_token": "'"$ANTHROPIC_API_KEY"'"
  }'
```

```bash
curl "https://api.optimizationinversion.com/discover-tools?vendor=openai&model=gpt-5&force_refresh=true" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Analyze with vendor only

```bash
curl "https://lidlift.optimizationinversion.com/api/analyze" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find the safest way to inspect today's production logs.",
    "vendor": "openai",
    "model": "gpt-5"
  }'
```

If you pass both `vendor` and `tools`, LidLift merges the vendor-discovered tools with your supplied catalog and prefers the later definition when names collide.

`/api/analyze` also accepts `force_refresh: true` and will pass it through to vendor discovery before ranking.

### MCP usage

The Cloudflare Worker now exposes a `discover_vendor_tools` MCP tool and `rank_tools` accepts `vendor`, `model`, and optional `auth_token`.

```json
{
  "name": "rank_tools",
  "arguments": {
    "prompt": "Review the repo and patch the failing test without publishing anything.",
    "vendor": "xai",
    "model": "grok-4.20-reasoning"
  }
}
```

## Production Hardening & Testing

### Cache strategy

- Default cache TTL is `600` seconds through `LIDLIFT_DISCOVERY_CACHE_TTL_SECONDS`
- Web routes fall back to in-process memory cache
- The Cloudflare Worker can use an optional `DISCOVERY_CACHE` KV binding for shared cache across isolates
- Use `force_refresh=true` only for CI, debugging, or vendor validation drift checks. It bypasses cache and increases upstream pressure

### Rate-limit guidance

- LidLift returns structured discovery errors with codes such as `ERR_RATE_LIMIT`, `ERR_AUTH`, and `ERR_VENDOR`
- When a vendor returns `429`, LidLift preserves `retryAfterSeconds` when available
- Recommended production policy: keep the default 10 minute TTL, avoid force refresh in hot paths, and route customer-triggered refreshes through explicit admin actions

### Test coverage

These discovery hardening tests now live under `packages/core/src/vendors/__tests__/`:

- `autoDetectVendor` coverage for `X-Vendor`, provider-specific headers, bearer token patterns, and `User-Agent`
- `discoverVendorTools` cache hit, miss, force refresh, TTL expiry, and sanitized error behavior
- Adapter coverage for OpenAI live validation plus Anthropic, xAI, and Gemini static built-in fallbacks

### Add a new vendor

1. Add the vendor literal to [packages/core/src/types.ts](/Users/Igor/Desktop/genesis-conductor-app/packages/core/src/types.ts:4).
2. Extend `normalizeVendor`, default model mapping, and environment variable lookup in [packages/core/src/discovery.ts](/Users/Igor/Desktop/genesis-conductor-app/packages/core/src/discovery.ts:1).
3. Add a built-in manifest entry set and expose it through `vendorAdapterRegistry`.
4. Add auto-detection hints in [packages/core/src/vendors/auto-detect.ts](/Users/Igor/Desktop/genesis-conductor-app/packages/core/src/vendors/auto-detect.ts:1) if the vendor has recognizable headers or token patterns.
5. Add adapter and discovery tests in `packages/core/src/vendors/__tests__/`.

## Deploy

### Web on Vercel

1. The production Vercel project is linked to this repository with `apps/web` as the root directory.
2. Add `AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL`, and `NEXT_PUBLIC_MCP_SERVER_URL`.
3. Push to `main` to trigger a Git-backed deployment, or use Vercel previews for branch validation.

### MCP server on Cloudflare

1. Deploy from `workers/mcp`.
2. Publish with `pnpm --filter mcp deploy`.
3. The production MCP endpoint is `https://api.optimizationinversion.com/mcp`.

## Validation

These commands are already passing in this workspace:

```bash
pnpm --filter @tool-dissonance/core test
pnpm --filter mcp check
pnpm --filter mcp test
pnpm --filter web lint
pnpm build
```
