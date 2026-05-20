from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from services.bookkeeper.reconcile import simulate_post_state
from services.common.config import RuntimeSettings
from services.common.rpc import BaseRpcClient, receipt_record
from services.common.validation import sha256_digest


async def execute_cycle(
    evidence: dict[str, Any],
    *,
    mode: str,
    runtime: RuntimeSettings,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    quote = evidence["quote"]
    if mode == "dry_run":
        receipts = []
        for step in ("swap", "unwrap", "sweep", "refuel"):
            receipts.append(
                receipt_record(
                    step,
                    status="simulated",
                    source="dry_run",
                    tx_hash=f"dryrun-{sha256_digest({'cycle_id': evidence['cycle_id'], 'step': step})[:16]}",
                )
            )
        simulated_post_state = simulate_post_state(
            evidence["pre_state"],
            delta_eth=quote["expected_delta_eth"],
        )
        return receipts, simulated_post_state

    if not runtime.allow_local_execution:
        raise RuntimeError("Live execution requires ALLOW_LOCAL_EXECUTION=true")
    if not runtime.base_rpc_url:
        raise RuntimeError("Live execution requires BASE_RPC_URL")
    if not runtime.signed_bundle_file:
        raise RuntimeError("Live execution requires GENESIS_SIGNED_BUNDLE_FILE")

    bundle_path = Path(runtime.signed_bundle_file)
    with bundle_path.open("r", encoding="utf-8") as handle:
        bundle = json.load(handle)
    raw_transactions = bundle.get("raw_transactions") or []
    if not raw_transactions:
        raise RuntimeError("Signed bundle file must contain raw_transactions")

    client = BaseRpcClient(runtime.base_rpc_url)
    receipts: list[dict[str, Any]] = []
    for index, raw_tx in enumerate(raw_transactions):
        tx_hash = await client.send_raw_transaction(raw_tx)
        receipt = await client.wait_for_receipt(tx_hash)
        receipts.append(
            receipt_record(
                f"bundle_{index}",
                status="submitted",
                source="local_rpc",
                tx_hash=tx_hash,
                extra=receipt,
            )
        )
    return receipts, None
