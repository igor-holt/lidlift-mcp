#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

./bin/one-click-launch.sh --mode eth-agent-2026 --capsule config/soul_capsule.json --proof-gate on --dry-run
