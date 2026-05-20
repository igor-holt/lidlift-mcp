from __future__ import annotations

import json
import secrets
from pathlib import Path

from services.common.config import runtime_settings
from services.common.models import SoulCapsuleConfig, WalletPolicyConfig
from services.common.paths import config_dir, wallets_dir
from services.common.validation import contains_secret_material, ensure_not_placeholder

DISALLOWED_CONFIG_KEYS = {"api_key", "private_key", "secret", "mnemonic", "seed_phrase", "password"}


def _scan_json_file(path: Path) -> list[str]:
    issues: list[str] = []
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    def walk(node: object, trail: str = "") -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                lowered = key.lower()
                current = f"{trail}.{key}" if trail else key
                if lowered in DISALLOWED_CONFIG_KEYS:
                    issues.append(f"{path.name}:{current} stores a prohibited secret-like key")
                walk(value, current)
        elif isinstance(node, list):
            for index, item in enumerate(node):
                walk(item, f"{trail}[{index}]")
        elif isinstance(node, str) and contains_secret_material(node):
            issues.append(f"{path.name}:{trail or '<root>'} contains secret-like material")

    walk(payload)
    return issues


def startup_security_summary() -> list[str]:
    issues: list[str] = []
    for path in (*config_dir().glob("*.json"), *wallets_dir().glob("*.json")):
        issues.extend(_scan_json_file(path))

    settings = runtime_settings()
    if settings.readonly_api_token:
        try:
            ensure_not_placeholder(settings.readonly_api_token, field_name="READONLY_API_TOKEN")
        except ValueError as exc:
            issues.append(str(exc))
    return issues


def assert_safe_startup() -> None:
    issues = startup_security_summary()
    if issues:
        raise RuntimeError(" | ".join(issues))


def evaluate_candidate_policy(
    *,
    quote: dict,
    capsule: SoulCapsuleConfig,
    wallet_policy: WalletPolicyConfig,
) -> dict:
    reasons: list[str] = []
    if capsule.emergency_pause:
        reasons.append("Emergency pause is active.")
    if quote["route_name"] not in capsule.dex_route_allowlist:
        reasons.append("Route is not in the soul capsule allowlist.")
    if quote["token_in_symbol"] not in capsule.token_allowlist:
        reasons.append("Input token is not allowed by the soul capsule.")
    if quote["token_in_symbol"] not in wallet_policy.allowed_tokens:
        reasons.append("Input token is not allowed by the wallet policy.")
    if quote["slippage_bps"] > capsule.max_slippage_bps:
        reasons.append("Configured slippage exceeds capsule maximum.")
    gas_gwei = quote["gas_price_wei"] / 1_000_000_000 if quote["gas_price_wei"] else 0
    if gas_gwei > capsule.max_gas_gwei:
        reasons.append("Gas price exceeds capsule maximum.")
    if quote["expected_out_eth"] > wallet_policy.max_spend_per_cycle_eth:
        reasons.append("Expected output exceeds wallet policy per-cycle cap.")
    if quote["expected_delta_eth"] <= 0:
        reasons.append("Expected treasury delta is non-positive.")
    return {"admissible": not reasons, "reasons": reasons}


def authorize_bearer_token(authorization_header: str | None, expected_token: str | None) -> bool:
    if not expected_token or not authorization_header:
        return False
    scheme, _, token = authorization_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return False
    return secrets.compare_digest(token, expected_token)
