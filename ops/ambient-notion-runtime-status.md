# Ambient And Notion Runtime Status

Captured on `2026-04-20` from the local machine and current shell.

## Verified

- Ambient local config exists at `/Users/igorholt/.config/ambient-mcp/`.
- `identity.json` contains the expected identity keys: `created_at`, `private_key_pem`, `public_key_hex`, `version`.
- `admin-key.json` exists for Ambient admin operations.
- Ambient Cloudflare Worker project exists at `/Users/igorholt/ambient-api/`.
- Ambient remote health is live:

```text
GET https://ambient-api.iholt.workers.dev/health
{"status":"ok","service":"ambient-api","version":"1.0.0",...}
```

- `wrangler whoami` succeeds for the Ambient Cloudflare account.
- `wrangler deployments list` in `/Users/igorholt/ambient-api` shows deployed versions for `ambient-api`.

## Not Verified / Blocked

- `ntn workers list` currently fails with:

```text
error: No workspace selected.
hint: Run `ntn login` first, or set NOTION_WORKSPACE_ID.
```

- The current shell does **not** expose:
  - `NOTION_API_TOKEN`
  - `NOTION_WORKSPACE_ID`
  - `NOTION_WORKERS_CONFIG_FILE`

- Because Notion is unauthenticated in this shell, worker inventory, worker env vars, runs, and any "alpha workers" hosted through Notion cannot be verified from CLI right now.

- No local long-running Ambient or alpha worker process was observed beyond the macOS system `AmbientDisplayAgent`.
- No local listening port tied to a user-managed Ambient worker was observed during this check.

## Exact Commands Used

```bash
ntn workers list
ntn workers env --help
ntn workers runs --help
curl -sS https://ambient-api.iholt.workers.dev/health
npx wrangler whoami
npx wrangler deployments list
ps aux | rg -i 'ambient|alpha|notion worker|ntn workers|wrangler|workerd'
lsof -nP -iTCP -sTCP:LISTEN | rg -i '8787|ambient|wrangler|workerd|notion'
```

## Next Commands Once Credentials Exist

```bash
export NOTION_API_TOKEN='<token>'
export NOTION_WORKSPACE_ID='<workspace-id>'
ntn workers list
ntn workers runs list <worker-id>
ntn workers env list <worker-id>
```

If there is a specific worker called `alpha`, the expected validation sequence is:

```bash
ntn workers list | rg alpha
ntn workers get <alpha-worker-id>
ntn workers runs list <alpha-worker-id>
```
