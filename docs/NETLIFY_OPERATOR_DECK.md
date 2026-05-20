# Netlify Operator Deck

## Purpose

`web/` is a separate Netlify deployment surface for the proof-first stack. It mirrors read-only proof telemetry from
the FastAPI service and adds:

- Three.js operator visualization
- Netlify Blobs cache persistence for overview, evidence, and brief payloads
- Netlify Identity gating for operator-only brief generation
- Netlify AI Gateway support for summary generation

## Environment

Required:

- `PROOF_FIRST_API_BASE`

Optional:

- `NETLIFY_AI_GATEWAY_BASE_URL`
- `NETLIFY_AI_GATEWAY_TOKEN`
- `AI_GATEWAY_MODEL`
- `VITE_CF_AGENT_HOST`
- `OVERVIEW_TTL_SECONDS`
- `EVIDENCE_TTL_SECONDS`
- `BRIEF_TTL_SECONDS`

## Local Development

1. `cd web`
2. `npm install`
3. `PROOF_FIRST_API_BASE=http://localhost:8000 npm run dev`

If you need the full Netlify runtime for function inspection or an authenticated deploy flow, use `netlify dev` or
`netlify deploy` after `netlify link`.

## Hosted Routes

- `/api/proof-first/overview`
- `/api/proof-first/evidence?cycleId=<cycle-id>`
- `/api/balance`
- `/api/operator/brief`
- `/api/operator/session`

The brief and session routes are read-only from an execution standpoint. They do not submit transactions or mutate
treasury state. Blobs writes are limited to cache persistence.

If `VITE_CF_AGENT_HOST` is set, the deck also synchronizes overview and operator-brief state into the Cloudflare
session-memory sidecar and renders the persisted digest back into the UI.

## Identity Boundary

The operator brief route requires a Netlify Identity user with the `operator` or `admin` role. The balance route keeps
the upstream bearer-token requirement unchanged.

## Deployment

```bash
cd web
npm install
netlify link
netlify deploy --build
```
