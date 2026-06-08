# Proof-First Runbook

1. Configure `config/soul_capsule.json`, `config/treasury.json`, `config/tokens.json`, and `wallets/policy_matrix.json`.
2. Export `BASE_RPC_URL` and `READONLY_API_TOKEN` for the hosted read-only surface.
3. To surface qflop-backfill proof posture, set `QFLOP_BACKFILL_ROOT=/Users/Igor/wQFLOP/qflop-backfill` or leave the default path in place.
4. Inspect `GET /api/proof-first/qflop-backfill` and confirm the latest VDF proof, attestor source posture, A2A artifact count, and runtime findings.
5. Treat qflop-backfill VDF proofs as compute evidence only until a positive treasury ETH delta is reconciled by receipts.
6. If deploying the Netlify operator deck, set `PROOF_FIRST_API_BASE` to the FastAPI proof-first origin.
7. If using operator briefs, enable Netlify Identity roles and configure Netlify AI Gateway variables.
8. Run a dry run first and inspect:
   - `inputs/evidence.json`
   - `artifacts/proofs/latest.json`
   - `artifacts/reports/latest.json`
9. Confirm the latest reconciliation is marked `matched`.
10. Only then consider local live execution with `ALLOW_LOCAL_EXECUTION=true` and a signed bundle file outside the repo.
11. If any proof or reconciliation step fails, stop and treat the cycle as invalid.
