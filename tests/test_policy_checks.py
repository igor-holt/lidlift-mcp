from __future__ import annotations

from services.common.config import load_soul_capsule, load_wallet_policy
from services.executor.policy_checks import evaluate_candidate_policy


def test_policy_rejects_non_positive_delta(workspace):
    capsule = load_soul_capsule()
    wallet_policy = load_wallet_policy()
    quote = {
        "route_name": "aerodrome.manual.weth",
        "token_in_symbol": "FEE_TOKEN",
        "expected_out_eth": 0.01,
        "expected_delta_eth": -0.0001,
        "slippage_bps": 50,
        "gas_price_wei": 1,
    }

    state = evaluate_candidate_policy(quote=quote, capsule=capsule, wallet_policy=wallet_policy)

    assert state["admissible"] is False
    assert "Expected treasury delta is non-positive." in state["reasons"]
