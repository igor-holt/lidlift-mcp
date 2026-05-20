# Operations

## Local Dry Run

```bash
./bin/one-click-launch.sh --mode eth-agent-2026 --capsule config/soul_capsule.json --proof-gate on --dry-run
```

This writes:

- `inputs/evidence.json`
- `artifacts/proofs/<cycle_id>.json`
- `artifacts/reports/<cycle_id>.json`

Dry-run mode uses `config/treasury.json` offline balances and the configured manual quote in `config/tokens.json`.

## Local Live Execution

Live local execution is disabled until all three are set:

- `ALLOW_LOCAL_EXECUTION=true`
- `BASE_RPC_URL=https://...`
- `GENESIS_SIGNED_BUNDLE_FILE=/absolute/path/to/bundle.json`

The bundle file must contain:

```json
{
  "raw_transactions": ["0x..."]
}
```

The hosted app never submits transactions.
