# Genesis Conductor Seismic Command

A unified, user-ready command console for Genesis Seismic Log telemetry with procedural liquid visualization and
assistant integrations (OpenAI + Anthropic). Designed as the primary site for **https://www.genesisconductor.io**
via Firebase Hosting + Functions.

## Features
- Live / local / auto data toggle with local fallback in auto mode
- Procedural liquid canvas driven by seismic performance signals
- Single-call dashboard API (`/api/dashboard`) for faster refreshes
- Assistant connections for ChatGPT + Claude
- Built-in code snippets for API consumers
- Hybrid proof-first ETH console at `/proof-first`
- Netlify operator deck in `web/` with Three.js visualization, Blobs-backed caching, and Identity-gated AI briefs
- Optional Cloudflare Agents SDK runtime in `cloudflare/operator-session-agent/` for stateful operator session memory
- Read-only, bearer-protected balance API at `GET /api/balance`
- Local-only launcher for proof-first dry runs and guarded live execution
- Herodotus integration status for Data Structure Indexer planning and Satellite resolution

## Quick Start (Local)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

./scripts/dev.sh
```

Open `http://localhost:8000`.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `DATA_SOURCE` | `auto` | `auto`, `live`, or `local` data mode |
| `REMOTE_SEISMIC_BASE` | `https://qmem.genesisconductor.io` | Live API base URL |
| `ALLOW_REMOTE_OVERRIDE` | `false` | Allow overriding base URL via UI advanced panel |
| `OPENAI_API_KEY` | unset | OpenAI API key for ChatGPT integration |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model for Responses API |
| `ANTHROPIC_API_KEY` | unset | Anthropic API key for Claude integration |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Anthropic model for Messages API |
| `ANTHROPIC_VERSION` | `2023-06-01` | Anthropic API version header |
| `BASE_RPC_URL` | unset | Base JSON-RPC endpoint used by the proof-first overview and balance API |
| `READONLY_API_TOKEN` | unset | Bearer token required for `GET /api/balance` |
| `ALLOW_LOCAL_EXECUTION` | `false` | Enables local signed-bundle submission via the launcher |
| `GENESIS_SIGNED_BUNDLE_FILE` | unset | Absolute path to a JSON file containing raw signed transactions |
| `GENESIS_WORKSPACE_ROOT` | unset | Override repo root for tests or isolated runs |
| `QFLOP_BACKFILL_ROOT` | `/Users/Igor/wQFLOP/qflop-backfill` | Optional local qflop-backfill runtime root for read-only proof import |
| `QFLOP_PROOF_STALE_HOURS` | `24` | Freshness window for imported qflop VDF proof queue records |
| `PROOF_FIRST_API_BASE` | unset | Required by the Netlify operator deck to proxy the hosted FastAPI proof-first API |
| `NETLIFY_AI_GATEWAY_BASE_URL` | unset | Netlify AI Gateway base URL for operator brief generation |
| `NETLIFY_AI_GATEWAY_TOKEN` | unset | Netlify AI Gateway token for operator brief generation |
| `AI_GATEWAY_MODEL` | `gpt-4o-mini` | Model used by the Netlify operator brief function |
| `VITE_CF_AGENT_HOST` | unset | Optional Cloudflare Agents SDK worker origin used by the Netlify deck for session-memory sync |

## THRML Demo

The `/api/thrml/demo` endpoint runs a small Ising sampling demo in the Python backend. Install THRML (and JAX) to enable it:

```bash
pip install thrml
```

On Firebase Functions, the THRML demo returns an informational message instead.

## API Notes

- `GET /api/dashboard` returns a consolidated payload:
  - `requested_source`, `resolved_source`, `updated_at`
  - `health`, `bench`, `seismic`
- `GET /api/proof-first/overview` returns read-only policy, evidence, proof, and wallet state.
- `GET /api/proof-first/qflop-backfill` returns a read-only import of local qflop-backfill VDF proof, attestor, A2A, and runtime posture.
- The proof-first overview includes Herodotus integration status:
  - Satellite contract resolution is performed from Herodotus deployment manifests.
  - Data Structure Indexer planning is surfaced as guarded provenance and is not treated as proof by itself.
- The qflop-backfill import uses local runtime artifacts as evidence and GitHub source metadata from `igor-holt/wQFLOP`; it never reads `.env` or secret-bearing files.
- `GET /api/proof-first/evidence/{cycle_id}` returns the stored evidence/report bundle for a cycle.
- `GET /api/balance` requires `Authorization: Bearer <READONLY_API_TOKEN>` and only returns monitored wallet balance metadata.
- Existing endpoints remain available:
  - `GET /api/health`
  - `GET /api/bench/live`
  - `GET /api/seismic/status`

## Proof-First Launcher

Run the local proof-first flow in dry-run mode:

```bash
./bin/one-click-launch.sh --mode eth-agent-2026 --capsule config/soul_capsule.json --proof-gate on --dry-run
```

The hosted app remains read-only. Live local execution requires a signed bundle file outside the repo plus `ALLOW_LOCAL_EXECUTION=true`.

## Cloud Run Deployment

The Python app is the primary hosted target for the proof-first console.

```bash
docker build -t genesis-conductor-app .
docker run --rm -p 8080:8080 \
  -e BASE_RPC_URL=https://your-base-rpc.example \
  -e READONLY_API_TOKEN=replace-with-real-token \
  genesis-conductor-app
```

Set the same environment variables in Cloud Run for deployment.

## Netlify Operator Deck

The `web/` workspace deploys a separate read-only operator mirror with:

- Vite + Three.js UI
- Netlify Functions proxying `GET /api/proof-first/overview`, `GET /api/proof-first/evidence`, and `GET /api/balance`
- Netlify Blobs for cache persistence
- Netlify Identity for operator-only AI brief access
- Netlify AI Gateway for brief generation when credentials are configured

Use:

```bash
cd web
npm install
netlify link
netlify deploy
```

Set `PROOF_FIRST_API_BASE` in Netlify to the hosted FastAPI origin.

## Cloudflare Operator Session Agent

The optional Cloudflare worker in `cloudflare/operator-session-agent/` is a stateful session-memory sidecar. It can
store operator-facing summaries and latest proof posture, but it is not allowed to become a proof source or execution
authority.

## Firebase Deployment (Primary)

1. Ensure Firebase CLI is installed:
   ```bash
   npm install -g firebase-tools
   ```
2. Authenticate:
   ```bash
   firebase login
   ```
3. Set your Firebase project ID in `.firebaserc` (default is `genesis-seismic-command`).
4. (Optional) Set secrets for OpenAI + Anthropic:
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
5. Deploy:
   ```bash
   firebase deploy
   ```

Hosting serves the UI, and Functions power the `/api/*` endpoints.

`functions/` remains a legacy compatibility surface for the original seismic dashboard and is not extended for proof-first features.

## Sources
See `SOURCES.md` or `/static/sources.html` for citations.
