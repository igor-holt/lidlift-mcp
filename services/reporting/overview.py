from __future__ import annotations

from typing import Any

from services.bookkeeper.reconcile import snapshot_state
from services.common.artifacts import read_cycle_record, read_latest_cycle_record
from services.common import herodotus as herodotus_integration
from services.common.qflop_backfill import build_qflop_backfill_context
from services.common.config import (
    capsule_hash,
    load_soul_capsule,
    load_tokens_config,
    load_treasury_config,
    load_wallet_policy,
    runtime_settings,
)
from services.common.validation import now_utc_iso
from services.executor.policy_checks import startup_security_summary


async def build_proof_first_overview() -> dict[str, Any]:
    issues = startup_security_summary()
    latest_cycle = read_latest_cycle_record()
    runtime = runtime_settings()
    generated_at = now_utc_iso()

    capsule = load_soul_capsule()
    treasury = load_treasury_config()
    tokens = load_tokens_config()
    wallet_policy = load_wallet_policy()
    herodotus = await herodotus_integration.build_herodotus_context(
        herodotus=capsule.herodotus,
        treasury=treasury,
        reference_timestamp_iso=generated_at,
    )
    qflop_backfill = build_qflop_backfill_context()

    wallet_balances: dict[str, Any] = {}
    chain_state: dict[str, Any] = {"chain_id": treasury.chain_id, "chain_name": treasury.chain_name}
    if runtime.base_rpc_url:
        try:
            current_state = await snapshot_state(runtime.base_rpc_url, treasury, tokens, allow_offline=False)
            wallet_balances = current_state["wallets"]
            chain_state = current_state["chain"]
        except Exception as exc:  # noqa: BLE001
            issues.append(f"Live chain snapshot failed: {exc}")
    else:
        issues.append("BASE_RPC_URL is not configured; live wallet balances are unavailable.")
    if herodotus["status"] not in {"ready", "disabled"}:
        issues.append(herodotus["summary"])
    if qflop_backfill["status"] in {"degraded", "stale", "missing"}:
        issues.append(qflop_backfill["summary"])

    return {
        "generated_at": generated_at,
        "health": {
            "status": "ok" if not issues else "degraded",
            "issues": issues,
            "proof_required": capsule.proof_required,
            "emergency_pause": capsule.emergency_pause,
            "balance_api_enabled": bool(runtime.readonly_api_token),
        },
        "capsule": {
            "version": capsule.version,
            "hash": capsule_hash(capsule),
        },
        "herodotus": herodotus,
        "qflop_backfill": qflop_backfill,
        "policy_state": {
            "allowed_tokens": wallet_policy.allowed_tokens,
            "allowed_destinations_count": len(wallet_policy.allowed_destinations),
            "max_spend_per_cycle_eth": wallet_policy.max_spend_per_cycle_eth,
            "local_execution_enabled": wallet_policy.local_execution_enabled,
        },
        "chain": chain_state,
        "wallet_balances": wallet_balances,
        "latest_cycle_id": latest_cycle.get("cycle_id") if latest_cycle else None,
        "latest_quote": latest_cycle.get("evidence", {}).get("quote") if latest_cycle else None,
        "latest_proof": latest_cycle.get("proof") if latest_cycle else None,
        "latest_reconciliation": latest_cycle.get("closing_report") if latest_cycle else None,
        "latest_evidence_created_at": latest_cycle.get("evidence", {}).get("created_at") if latest_cycle else None,
    }


def load_cycle_evidence(cycle_id: str) -> dict[str, Any] | None:
    return read_cycle_record(cycle_id)


def load_qflop_backfill_context() -> dict[str, Any]:
    return build_qflop_backfill_context()
