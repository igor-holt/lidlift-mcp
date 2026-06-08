from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from .models import SoulCapsuleConfig, TokensConfig, TreasuryConfig, WalletPolicyConfig
from .paths import config_dir, wallets_dir
from .validation import ensure_http_url, stable_json_dumps

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class RuntimeSettings:
    base_rpc_url: str | None
    readonly_api_token: str | None
    allow_local_execution: bool
    signed_bundle_file: str | None


def _load_model(path: Path, model_cls: type[T]) -> T:
    with path.open("r", encoding="utf-8") as handle:
        return model_cls.model_validate(json.load(handle))


def load_soul_capsule(path: str | Path | None = None) -> SoulCapsuleConfig:
    target = Path(path) if path else config_dir() / "soul_capsule.json"
    return _load_model(target, SoulCapsuleConfig)


def load_treasury_config(path: str | Path | None = None) -> TreasuryConfig:
    target = Path(path) if path else config_dir() / "treasury.json"
    return _load_model(target, TreasuryConfig)


def load_tokens_config(path: str | Path | None = None) -> TokensConfig:
    target = Path(path) if path else config_dir() / "tokens.json"
    return _load_model(target, TokensConfig)


def load_wallet_policy(path: str | Path | None = None) -> WalletPolicyConfig:
    target = Path(path) if path else wallets_dir() / "policy_matrix.json"
    return _load_model(target, WalletPolicyConfig)


def runtime_settings() -> RuntimeSettings:
    base_rpc_url = os.environ.get("BASE_RPC_URL")
    if base_rpc_url:
        base_rpc_url = ensure_http_url(base_rpc_url, field_name="BASE_RPC_URL")
    return RuntimeSettings(
        base_rpc_url=base_rpc_url,
        readonly_api_token=os.environ.get("READONLY_API_TOKEN"),
        allow_local_execution=os.environ.get("ALLOW_LOCAL_EXECUTION", "false").lower() in {"1", "true", "yes"},
        signed_bundle_file=os.environ.get("GENESIS_SIGNED_BUNDLE_FILE"),
    )


def capsule_hash(capsule: SoulCapsuleConfig) -> str:
    from .validation import sha256_digest

    return sha256_digest(stable_json_dumps(capsule.model_dump(mode="json")))
