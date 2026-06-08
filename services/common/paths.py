from __future__ import annotations

import os
from pathlib import Path


def workspace_root() -> Path:
    override = os.environ.get("GENESIS_WORKSPACE_ROOT")
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parents[2]


def config_dir() -> Path:
    return workspace_root() / "config"


def wallets_dir() -> Path:
    return workspace_root() / "wallets"


def schemas_dir() -> Path:
    return workspace_root() / "schemas"


def inputs_dir() -> Path:
    return workspace_root() / "inputs"


def artifacts_dir() -> Path:
    return workspace_root() / "artifacts"


def reports_dir() -> Path:
    return artifacts_dir() / "reports"


def proofs_dir() -> Path:
    return artifacts_dir() / "proofs"


def simulations_dir() -> Path:
    return artifacts_dir() / "simulations"


def ensure_runtime_dirs() -> None:
    for path in (inputs_dir(), reports_dir(), proofs_dir(), simulations_dir()):
        path.mkdir(parents=True, exist_ok=True)
