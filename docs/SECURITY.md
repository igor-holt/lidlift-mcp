# Security

- No hosted execution endpoints exist. `/api/balance` is the only protected read-only API and requires `READONLY_API_TOKEN`.
- Startup fails if config files contain prohibited secret-like keys or material.
- `scripts/secret_scan.py` fails CI on obvious embedded secrets or literal credentials.
- Proof-first configs use sample addresses only. Replace them with operator-owned addresses before live use.
- Treat any previously exposed private keys as compromised and rotate them outside this repo before enabling local execution.
