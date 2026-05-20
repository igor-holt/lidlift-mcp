from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture
def workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    for relative in ("config", "wallets", "schemas"):
        shutil.copytree(REPO_ROOT / relative, tmp_path / relative)

    for relative in (
        "artifacts/proofs",
        "artifacts/reports",
        "artifacts/simulations",
        "inputs",
    ):
        (tmp_path / relative).mkdir(parents=True, exist_ok=True)

    monkeypatch.setenv("GENESIS_WORKSPACE_ROOT", str(tmp_path))
    monkeypatch.delenv("BASE_RPC_URL", raising=False)
    monkeypatch.delenv("READONLY_API_TOKEN", raising=False)
    monkeypatch.delenv("ALLOW_LOCAL_EXECUTION", raising=False)
    monkeypatch.delenv("GENESIS_SIGNED_BUNDLE_FILE", raising=False)
    monkeypatch.setenv("QFLOP_BACKFILL_ROOT", str(tmp_path / "missing-qflop-backfill"))
    monkeypatch.delenv("QFLOP_PROOF_STALE_HOURS", raising=False)
    return tmp_path
