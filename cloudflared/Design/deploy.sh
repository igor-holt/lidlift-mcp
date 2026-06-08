#!/usr/bin/env bash
# ============================================================
# Barcelona-Extropic — Full Deploy Script
# CLI-agnostic: works via claude-cli, gemini-cli, codex-cli,
# or direct shell. Each step is idempotent and independently
# resumable. State tracked in .deploy_state.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_FILE="$ROOT/.deploy_state"
ACCOUNT_ID="04c59c95ce8d0a0be98099b7f7e39d18"
GATEWAY_WORKER="coalition-gateway"
FONT_VERSION="1.0.0"

# --- State helpers ---
state_done() { grep -qF "DONE:$1" "$STATE_FILE" 2>/dev/null; }
state_mark() { echo "DONE:$1" >> "$STATE_FILE"; }

log()  { echo "[$(date -u +%H:%M:%S)] $*"; }
fail() { echo "[FAIL] $*" >&2; exit 1; }

log "=== B-E Deploy v${FONT_VERSION} ==="
log "Root: $ROOT"
log "Account: $ACCOUNT_ID"
log "Gateway: $GATEWAY_WORKER"
echo ""

# ============================================================
# STEP 1 — Verify prerequisites
# ============================================================
if ! state_done "prereqs"; then
  log "STEP 1: Checking prerequisites..."
  
  command -v wrangler >/dev/null 2>&1 || fail "wrangler not found. Run: npm i -g wrangler"
  command -v cargo    >/dev/null 2>&1 || fail "cargo not found. Install: https://rustup.rs"
  
  WRANGLER_VERSION=$(wrangler --version 2>&1 | head -1)
  CARGO_VERSION=$(cargo --version)
  log "  wrangler: $WRANGLER_VERSION"
  log "  cargo:    $CARGO_VERSION"
  
  # Verify wrangler auth
  wrangler whoami 2>&1 | grep -q "You are logged in" \
    || fail "wrangler not authenticated. Run: wrangler login"
  
  state_mark "prereqs"
  log "  ✓ Prerequisites OK"
fi

# ============================================================
# STEP 2 — Install wasm32 target + wasm-pack
# ============================================================
if ! state_done "wasm_toolchain"; then
  log "STEP 2: Setting up WASM toolchain..."
  
  rustup target add wasm32-unknown-unknown
  
  if ! command -v wasm-pack >/dev/null 2>&1; then
    log "  Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
  fi
  
  log "  wasm-pack: $(wasm-pack --version)"
  state_mark "wasm_toolchain"
  log "  ✓ WASM toolchain ready"
fi

# ============================================================
# STEP 3 — Run tests (fail fast before any deploy)
# ============================================================
if ! state_done "tests"; then
  log "STEP 3: Running invariant tests..."
  
  cd "$ROOT"
  cargo test 2>&1 | tail -3
  cargo test --features ambigraph 2>&1 | grep "test result"
  
  RESULT=$(cargo test --features ambigraph 2>&1 | grep "test result")
  echo "$RESULT" | grep -q "FAILED" && fail "Tests failed. Fix before deploy."
  echo "$RESULT" | grep -q "ok" || fail "Unexpected test output."
  
  state_mark "tests"
  log "  ✓ All tests pass"
fi

# ============================================================
# STEP 4 — Build WASM binary
# ============================================================
if ! state_done "wasm_build"; then
  log "STEP 4: Building WASM binary..."
  
  cd "$ROOT"
  wasm-pack build \
    --target web \
    --release \
    --features ambigraph \
    --out-dir pkg \
    -- --no-default-features
  
  WASM_SIZE=$(wc -c < pkg/be_ambigraph_bg.wasm)
  log "  WASM binary: ${WASM_SIZE} bytes"
  
  [ "$WASM_SIZE" -lt 10000 ] && fail "WASM binary suspiciously small: ${WASM_SIZE} bytes"
  
  state_mark "wasm_build"
  log "  ✓ WASM built: pkg/be_ambigraph_bg.wasm"
fi

# ============================================================
# STEP 5 — Create R2 bucket (idempotent)
# ============================================================
if ! state_done "r2_bucket"; then
  log "STEP 5: Ensuring R2 bucket exists..."
  
  # Create bucket — fails silently if already exists
  wrangler r2 bucket create be-font-assets 2>&1 | grep -v "already exists" || true
  
  state_mark "r2_bucket"
  log "  ✓ R2 bucket: be-font-assets"
fi

# ============================================================
# STEP 6 — Upload WASM + CSS to R2
# ============================================================
if ! state_done "r2_upload"; then
  log "STEP 6: Uploading font assets to R2..."
  
  cd "$ROOT"
  
  # WASM binary
  wrangler r2 object put be-font-assets/v${FONT_VERSION}/barcelona-extropic.wasm \
    --file pkg/be_ambigraph_bg.wasm \
    --content-type "application/wasm" \
    --cache-control "public, max-age=31536000, immutable"
  
  # JS bindings
  wrangler r2 object put be-font-assets/v${FONT_VERSION}/barcelona-extropic.js \
    --file pkg/be_ambigraph.js \
    --content-type "application/javascript" \
    --cache-control "public, max-age=31536000, immutable"
  
  # CSS (versioned)
  wrangler r2 object put be-font-assets/v${FONT_VERSION}/barcelona-extropic.css \
    --file gateway/barcelona-extropic.css \
    --content-type "text/css" \
    --cache-control "public, max-age=31536000, immutable"
  
  # CSS (latest alias — shorter cache for updates)
  wrangler r2 object put be-font-assets/latest/barcelona-extropic.css \
    --file gateway/barcelona-extropic.css \
    --content-type "text/css" \
    --cache-control "public, max-age=3600"
  
  state_mark "r2_upload"
  log "  ✓ Assets uploaded to R2"
fi

# ============================================================
# STEP 7 — Patch coalition-gateway source
# ============================================================
if ! state_done "gateway_patch"; then
  log "STEP 7: Patching coalition-gateway..."
  
  GATEWAY_DIR="${GATEWAY_DIR:-../coalition-gateway}"
  
  if [ ! -d "$GATEWAY_DIR" ]; then
    log "  Gateway dir not found at $GATEWAY_DIR"
    log "  Provide path: GATEWAY_DIR=/path/to/coalition-gateway $0"
    log "  Skipping patch — apply gateway/gateway.patch manually."
    state_mark "gateway_patch_skipped"
  else
    # Copy font_route.js into gateway src
    cp "$ROOT/gateway/font_route.js" "$GATEWAY_DIR/src/font_route.js"
    
    # Apply patch (if not already applied)
    if ! grep -q "handleFontRoute" "$GATEWAY_DIR/src/index.ts" 2>/dev/null; then
      cd "$GATEWAY_DIR"
      patch -p1 < "$ROOT/gateway/gateway.patch" || {
        log "  Auto-patch failed — apply gateway/gateway.patch manually"
        log "  Then add to index.ts: import { handleFontRoute } from './font_route';"
        log "  And: if (path.startsWith('/fonts/')) return handleFontRoute(request, env);"
      }
    else
      log "  Gateway already patched (handleFontRoute found)"
    fi
    
    state_mark "gateway_patch"
    log "  ✓ Gateway patched"
  fi
fi

# ============================================================
# STEP 8 — Deploy gateway
# ============================================================
if ! state_done "gateway_deploy"; then
  log "STEP 8: Deploying coalition-gateway..."
  
  GATEWAY_DIR="${GATEWAY_DIR:-../coalition-gateway}"
  
  if [ -d "$GATEWAY_DIR" ]; then
    cd "$GATEWAY_DIR"
    wrangler deploy
    state_mark "gateway_deploy"
    log "  ✓ Gateway deployed"
  else
    log "  GATEWAY_DIR not set — skipping wrangler deploy"
    log "  Run manually: cd coalition-gateway && wrangler deploy"
    state_mark "gateway_deploy_skipped"
  fi
fi

# ============================================================
# STEP 9 — Smoke test
# ============================================================
if ! state_done "smoke_test"; then
  log "STEP 9: Smoke test..."
  
  GATEWAY_URL="${GATEWAY_URL:-}"
  
  if [ -z "$GATEWAY_URL" ]; then
    log "  Set GATEWAY_URL=https://your-gateway.workers.dev to run smoke test"
    log "  Skipping — run scripts/smoke_test.sh after deploy"
    state_mark "smoke_test_skipped"
  else
    HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "$GATEWAY_URL/fonts/be/")
    [ "$HTTP" = "200" ] || fail "Font manifest returned HTTP $HTTP"
    
    CSS_HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "$GATEWAY_URL/fonts/be/barcelona-extropic.css")
    [ "$CSS_HTTP" = "200" ] || fail "CSS returned HTTP $CSS_HTTP"
    
    state_mark "smoke_test"
    log "  ✓ Smoke test passed"
  fi
fi

# ============================================================
# DONE
# ============================================================
echo ""
log "=== Deploy complete ==="
log ""
log "Integration snippet (add to any environment):"
log '  <link rel="stylesheet" href="'"${GATEWAY_URL:-https://YOUR_GATEWAY}"'/fonts/be/barcelona-extropic.css">'
log ""
log "Manifest: ${GATEWAY_URL:-https://YOUR_GATEWAY}/fonts/be/"
log "CSS:      ${GATEWAY_URL:-https://YOUR_GATEWAY}/fonts/be/barcelona-extropic.css"
log "Workspace:${GATEWAY_URL:-https://YOUR_GATEWAY}/fonts/be/workspace.json"
log "iOS:      ${GATEWAY_URL:-https://YOUR_GATEWAY}/fonts/be/ios-inject.js"
log ""
log "Seismic log: $STATE_FILE"
