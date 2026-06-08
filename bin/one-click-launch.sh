#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHON_BIN="${GENESIS_PYTHON_BIN:-}"

if [[ -z "${PYTHON_BIN}" ]] && command -v uvicorn >/dev/null 2>&1; then
  UVICORN_DIR="$(dirname "$(command -v uvicorn)")"
  if [[ -x "${UVICORN_DIR}/python3.14" ]]; then
    PYTHON_BIN="${UVICORN_DIR}/python3.14"
  fi
fi

if [[ -z "${PYTHON_BIN}" ]] && command -v pytest >/dev/null 2>&1; then
  PYTEST_DIR="$(dirname "$(command -v pytest)")"
  if [[ -x "${PYTEST_DIR}/python3.14" ]]; then
    PYTHON_BIN="${PYTEST_DIR}/python3.14"
  fi
fi

if [[ -z "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="$(command -v python3)"
fi

"${PYTHON_BIN}" -m services.executor.cli "$@"
