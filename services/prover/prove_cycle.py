from __future__ import annotations

from typing import Any

from services.common.validation import now_utc_iso, sha256_digest


def create_cycle_proof(evidence: dict[str, Any], receipts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    receipts = receipts or []
    receipt_hashes = [sha256_digest(receipt) for receipt in receipts]
    pre_state_digest = sha256_digest(evidence["pre_state"])
    payload_digest = sha256_digest(
        {
            "evidence": evidence,
            "receipt_hashes": receipt_hashes,
        }
    )
    return {
        "proof_id": f"proof-{evidence['cycle_id']}",
        "cycle_id": evidence["cycle_id"],
        "created_at": now_utc_iso(),
        "proof_engine": "deterministic-sidecar-v1",
        "capsule_hash": evidence["capsule"]["hash"],
        "pre_state_digest": pre_state_digest,
        "payload_digest": payload_digest,
        "receipt_hashes": receipt_hashes,
        "verified": False,
        "verification_notes": [],
    }
