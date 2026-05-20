#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export DATA_SOURCE=${DATA_SOURCE:-auto}
uvicorn app.main:app --reload --port 8000
