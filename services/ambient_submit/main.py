from __future__ import annotations

from uuid import uuid4

from services.bookkeeper.reconcile import snapshot_state
from services.common.artifacts import upsert_cycle_record, write_latest_evidence
from services.common.config import (
    capsule_hash,
    load_soul_capsule,
    load_tokens_config,
    load_treasury_config,
    load_wallet_policy,
    runtime_settings,
)
from services.common import herodotus as herodotus_integration
from services.common.validation import now_utc_iso
from services.executor.policy_checks import evaluate_candidate_policy


def thermodynamic_action_score(
    *,
    expected_delta_eth: float,
    gas_cost_eth: float,
    slippage_cost_eth: float,
    proof_cost_eth: float = 0.0,
) -> float:
    return expected_delta_eth - gas_cost_eth - slippage_cost_eth - proof_cost_eth


async def generate_candidate_cycle(
    *,
    capsule_path: str | None = None,
    dry_run: bool = False,
) -> dict:
    capsule = load_soul_capsule(capsule_path)
    treasury = load_treasury_config()
    tokens = load_tokens_config()
    wallet_policy = load_wallet_policy()
    settings = runtime_settings()

    if tokens.manual_quote is None:
        raise RuntimeError("tokens.json must define a manual_quote for proof-first dry-run generation")

    cycle_id = f"cycle-{uuid4().hex[:12]}"
    pre_state = await snapshot_state(settings.base_rpc_url, treasury, tokens, allow_offline=dry_run)
    gas_price_wei = pre_state["chain"]["gas_price_wei"] or tokens.manual_quote.gas_price_wei or 0
    gas_cost_eth = (tokens.manual_quote.gas_estimate * gas_price_wei) / 1_000_000_000_000_000_000
    slippage_cost_eth = tokens.manual_quote.expected_out_eth * (tokens.manual_quote.max_slippage_bps / 10_000)
    expected_delta_eth = tokens.manual_quote.expected_out_eth - gas_cost_eth

    # Lowest-risk path: use an operator-supplied manual quote until a receipts-backed Aerodrome
    # quote adapter is wired. This keeps hosted metrics honest because the quote is surfaced as evidence.
    quote = {
        "route_name": tokens.manual_quote.route_name,
        "source_mode": "configured_manual",
        "token_in_symbol": tokens.manual_quote.token_in_symbol,
        "token_out_symbol": tokens.manual_quote.token_out_symbol,
        "amount_in_units": tokens.manual_quote.amount_in_units,
        "expected_out_eth": tokens.manual_quote.expected_out_eth,
        "expected_delta_eth": expected_delta_eth,
        "gas_estimate": tokens.manual_quote.gas_estimate,
        "gas_price_wei": gas_price_wei,
        "expected_gas_cost_eth": gas_cost_eth,
        "slippage_bps": tokens.manual_quote.max_slippage_bps,
        "score_eth": thermodynamic_action_score(
            expected_delta_eth=expected_delta_eth,
            gas_cost_eth=gas_cost_eth,
            slippage_cost_eth=slippage_cost_eth,
        ),
        "notes": list(tokens.manual_quote.notes),
    }

    policy_state = evaluate_candidate_policy(
        quote=quote,
        capsule=capsule,
        wallet_policy=wallet_policy,
    )

    created_at = now_utc_iso()
    herodotus = await herodotus_integration.build_herodotus_context(
        herodotus=capsule.herodotus,
        treasury=treasury,
        reference_timestamp_iso=created_at,
    )

    evidence = {
        "cycle_id": cycle_id,
        "created_at": created_at,
        "chain": {
            "chain_id": treasury.chain_id,
            "chain_name": treasury.chain_name,
            "snapshot_source": pre_state["source_mode"],
        },
        "capsule": {
            "version": capsule.version,
            "hash": capsule_hash(capsule),
            "proof_required": capsule.proof_required,
        },
        "policy_state": policy_state,
        "pre_state": pre_state,
        "quote": quote,
        "herodotus": herodotus,
    }
    pre_state["cycle_id"] = cycle_id
    write_latest_evidence(evidence)
    upsert_cycle_record(cycle_id, evidence=evidence)
    return evidence


def reject_if_net_nonpositive(evidence: dict) -> None:
    if not evidence["policy_state"]["admissible"]:
        raise RuntimeError("; ".join(evidence["policy_state"]["reasons"]))
