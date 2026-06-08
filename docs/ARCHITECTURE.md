# Proof-First Architecture

The repo now has two product surfaces:

- `GET /` remains the seismic command dashboard.
- `GET /proof-first` is the read-only ETH operator console.
- `web/` is a Netlify-hosted edge mirror with Three.js visualization and operator-only summary tooling.

Proof-first work is split into five layers:

1. `services/common/` loads validated config, paths, schemas, and Base JSON-RPC helpers.
2. `services/ambient_submit/` builds an admissible candidate cycle from snapshots and a configured quote input.
3. `services/common/herodotus.py` resolves Herodotus Data Structure Indexer planning state and Satellite contract metadata as a guarded trust boundary.
4. `services/common/qflop_backfill.py` imports local qflop-backfill VDF proof, attestor, A2A, and runtime posture without reading secret-bearing files.
5. `services/prover/` emits and verifies deterministic mock proof artifacts so the pipeline stays fail-closed without claiming a live STARK integration.
6. `services/bookkeeper/` snapshots balances and reconciles treasury deltas.
7. `services/executor/` enforces local-only execution and guarded balance API auth.
8. `web/netlify/functions/` mirrors read-only proof state through Netlify Blobs, Identity, AI Gateway, and CDN caching.
9. `cloudflare/operator-session-agent/` persists operator session summaries only; it never becomes a proof source or executor.

Hosted routes only expose read-only state. The launcher in `bin/one-click-launch.sh` is the only supported local execution entrypoint.
