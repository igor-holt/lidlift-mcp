from __future__ import annotations

from copy import deepcopy
from typing import Any

from services.common.config import TokensConfig, TreasuryConfig
from services.common.rpc import BaseRpcClient
from services.common.validation import eth_to_wei, now_utc_iso, wei_to_eth


async def snapshot_state(
    rpc_url: str | None,
    treasury: TreasuryConfig,
    tokens: TokensConfig,
    *,
    allow_offline: bool = False,
) -> dict[str, Any]:
    if rpc_url:
        client = BaseRpcClient(rpc_url)
        block_number = await client.get_block_number()
        gas_price_wei = await client.get_gas_price()
        wallets = {
            "treasury": {
                "address": treasury.treasury_wallet_address,
                "native_balance_wei": await client.get_balance(treasury.treasury_wallet_address),
            },
            "monitored": {
                "address": treasury.monitored_wallet_address,
                "native_balance_wei": await client.get_balance(treasury.monitored_wallet_address),
            },
            "executor": {
                "address": treasury.executor_wallet_address,
                "native_balance_wei": await client.get_balance(treasury.executor_wallet_address),
            },
        }
        for index, address in enumerate(treasury.refuel_wallets):
            wallets[f"refuel_{index}"] = {
                "address": address,
                "native_balance_wei": await client.get_balance(address),
            }

        for wallet_name, wallet in wallets.items():
            wallet["native_eth"] = wei_to_eth(wallet["native_balance_wei"])
            token_balances: dict[str, Any] = {}
            for symbol, token in tokens.tokens.items():
                balance_wei = await client.get_erc20_balance(token.address, wallet["address"])
                token_balances[symbol] = {
                    "address": token.address,
                    "balance_wei": balance_wei,
                    "balance_decimal": wei_to_eth(balance_wei),
                    "decimals": token.decimals,
                }
            wallet["tokens"] = token_balances

        return {
            "captured_at": now_utc_iso(),
            "source_mode": "rpc",
            "chain": {
                "chain_id": treasury.chain_id,
                "chain_name": treasury.chain_name,
                "block_number": block_number,
                "gas_price_wei": gas_price_wei,
            },
            "wallets": wallets,
        }

    if not allow_offline:
        raise RuntimeError("BASE_RPC_URL is required for live snapshots")

    wallets: dict[str, Any] = {}
    address_map = {
        "treasury": treasury.treasury_wallet_address,
        "monitored": treasury.monitored_wallet_address,
        "executor": treasury.executor_wallet_address,
    }
    for index, address in enumerate(treasury.refuel_wallets):
        address_map[f"refuel_{index}"] = address

    for role, address in address_map.items():
        mock_balances = treasury.offline_balances.get(role, {})
        native_eth = mock_balances.get("native_eth", 0.0)
        wallets[role] = {
            "address": address,
            "native_balance_wei": eth_to_wei(native_eth),
            "native_eth": str(native_eth),
            "tokens": {
                symbol: {
                    "address": token.address,
                    "balance_wei": eth_to_wei(mock_balances.get(symbol, 0.0)),
                    "balance_decimal": str(mock_balances.get(symbol, 0.0)),
                    "decimals": token.decimals,
                }
                for symbol, token in tokens.tokens.items()
            },
        }

    gas_price_wei = tokens.manual_quote.gas_price_wei if tokens.manual_quote and tokens.manual_quote.gas_price_wei else 0
    return {
        "captured_at": now_utc_iso(),
        "source_mode": "offline",
        "chain": {
            "chain_id": treasury.chain_id,
            "chain_name": treasury.chain_name,
            "block_number": None,
            "gas_price_wei": gas_price_wei,
        },
        "wallets": wallets,
    }


def simulate_post_state(pre_state: dict[str, Any], *, delta_eth: float) -> dict[str, Any]:
    simulated = deepcopy(pre_state)
    delta_wei = eth_to_wei(delta_eth)
    treasury_wallet = simulated["wallets"]["treasury"]
    treasury_wallet["native_balance_wei"] += delta_wei
    treasury_wallet["native_eth"] = wei_to_eth(treasury_wallet["native_balance_wei"])
    simulated["captured_at"] = now_utc_iso()
    simulated["source_mode"] = "simulated"
    return simulated


def reconcile_cycle(
    pre_state: dict[str, Any],
    receipts: list[dict[str, Any]],
    post_state: dict[str, Any],
    *,
    expected_delta_eth: float,
    mode: str,
) -> dict[str, Any]:
    pre_wei = int(pre_state["wallets"]["treasury"]["native_balance_wei"])
    post_wei = int(post_state["wallets"]["treasury"]["native_balance_wei"])
    realized_delta_wei = post_wei - pre_wei
    realized_delta_eth = float(wei_to_eth(realized_delta_wei))
    matched = abs(realized_delta_eth - expected_delta_eth) <= 0.000001
    status = "simulated" if mode == "dry_run" else "verified"
    notes = []
    if mode == "dry_run":
        notes.append("Dry-run reconciliation uses simulated treasury deltas and does not prove live profitability.")
    if not matched:
        notes.append("Expected and realized treasury deltas diverged.")

    return {
        "cycle_id": pre_state.get("cycle_id"),
        "created_at": now_utc_iso(),
        "mode": mode,
        "status": status if matched else "mismatch",
        "delta_source": "simulated" if mode == "dry_run" else "onchain",
        "expected_delta_eth": expected_delta_eth,
        "realized_delta_eth": realized_delta_eth,
        "matched": matched,
        "receipt_count": len(receipts),
        "notes": notes,
    }
