#!/usr/bin/env bash
# Smoke test — run after deploy.sh completes.
# Usage: GATEWAY_URL=https://your-gateway.workers.dev ./smoke_test.sh
set -euo pipefail

GATEWAY_URL="${1:-${GATEWAY_URL:-}}"
[ -z "$GATEWAY_URL" ] && { echo "Usage: $0 https://your-gateway.workers.dev"; exit 1; }

PASS=0; FAIL=0
check() {
  local label="$1" url="$2" expect="$3"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$code" = "$expect" ]; then
    echo "  PASS  $label ($code)"
    ((PASS++))
  else
    echo "  FAIL  $label — expected $expect got $code — $url"
    ((FAIL++))
  fi
}

check_body() {
  local label="$1" url="$2" needle="$3"
  local body
  body=$(curl -sf "$url" 2>/dev/null || echo "")
  if echo "$body" | grep -q "$needle"; then
    echo "  PASS  $label"
    ((PASS++))
  else
    echo "  FAIL  $label — '$needle' not found in response"
    ((FAIL++))
  fi
}

echo "=== B-E Smoke Test: $GATEWAY_URL ==="
echo ""

check      "Font manifest"          "$GATEWAY_URL/fonts/be/"                        "200"
check      "CSS delivery"           "$GATEWAY_URL/fonts/be/barcelona-extropic.css"  "200"
check      "Workspace JSON"         "$GATEWAY_URL/fonts/be/workspace.json"           "200"
check      "iOS inject script"      "$GATEWAY_URL/fonts/be/ios-inject.js"            "200"
check      "Gateway health"         "$GATEWAY_URL/health"                            "200"
check_body "CSS has --be-tracking"  "$GATEWAY_URL/fonts/be/barcelona-extropic.css"   "--be-tracking"
check_body "CSS has be-display"     "$GATEWAY_URL/fonts/be/barcelona-extropic.css"   ".be-display"
check_body "CSS has be-chiral"      "$GATEWAY_URL/fonts/be/barcelona-extropic.css"   ".be-chiral"
check_body "Manifest has endpoints" "$GATEWAY_URL/fonts/be/"                         "endpoints"

echo ""
echo "=== $PASS PASS / $FAIL FAIL ==="
[ "$FAIL" -eq 0 ] && echo "Status: STABLE" || { echo "Status: UNSTABLE"; exit 1; }
