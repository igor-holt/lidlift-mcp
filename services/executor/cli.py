from __future__ import annotations

import argparse
import asyncio
import sys

from services.ambient_submit.main import generate_candidate_cycle, reject_if_net_nonpositive
from services.bookkeeper.reconcile import reconcile_cycle, snapshot_state
from services.common.artifacts import upsert_cycle_record, write_proof
from services.common.config import load_tokens_config, load_treasury_config, runtime_settings
from services.executor.local_runner import execute_cycle
from services.executor.policy_checks import assert_safe_startup
from services.prover.prove_cycle import create_cycle_proof
from services.prover.verify_cycle import verify_cycle_proof


async def _run(args: argparse.Namespace) -> int:
    if args.mode != "eth-agent-2026":
        raise RuntimeError("Unsupported mode. Expected --mode eth-agent-2026")
    if args.proof_gate != "on":
        raise RuntimeError("Proof gate must remain enabled.")

    assert_safe_startup()
    evidence = await generate_candidate_cycle(capsule_path=args.capsule, dry_run=args.dry_run)
    reject_if_net_nonpositive(evidence)

    pre_proof = create_cycle_proof(evidence)
    pre_proof = verify_cycle_proof(evidence, pre_proof, [])
    if not pre_proof["verified"]:
        raise RuntimeError("Pre-execution proof verification failed.")

    runtime = runtime_settings()
    mode = "dry_run" if args.dry_run else "live"
    receipts, simulated_post_state = await execute_cycle(evidence, mode=mode, runtime=runtime)

    if simulated_post_state is None:
        treasury = load_treasury_config()
        tokens = load_tokens_config()
        post_state = await snapshot_state(runtime.base_rpc_url, treasury, tokens, allow_offline=False)
    else:
        post_state = simulated_post_state

    proof = create_cycle_proof(evidence, receipts)
    proof = verify_cycle_proof(evidence, proof, receipts)
    if not proof["verified"]:
        raise RuntimeError("Post-execution proof verification failed.")
    write_proof(evidence["cycle_id"], proof)

    closing_report = reconcile_cycle(
        evidence["pre_state"],
        receipts,
        post_state,
        expected_delta_eth=evidence["quote"]["expected_delta_eth"],
        mode=mode,
    )
    closing_report["cycle_id"] = evidence["cycle_id"]
    if not closing_report["matched"]:
        raise RuntimeError("Reconciliation failed.")

    upsert_cycle_record(
        evidence["cycle_id"],
        evidence=evidence,
        proof=proof,
        closing_report=closing_report,
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Genesis proof-first local launcher")
    parser.add_argument("--mode", required=True)
    parser.add_argument("--capsule", required=True)
    parser.add_argument("--proof-gate", choices={"on", "off"}, required=True)
    parser.add_argument("--dry-run", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return asyncio.run(_run(args))
    except Exception as exc:  # noqa: BLE001
        print(f"[genesis-proof-first] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
