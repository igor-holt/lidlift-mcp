from __future__ import annotations

from typing import Any

from services.common.validation import sha256_digest


def verify_cycle_proof(
    evidence: dict[str, Any],
    proof: dict[str, Any],
    receipts: list[dict[str, Any]],
) -> dict[str, Any]:
    expected_receipt_hashes = [sha256_digest(receipt) for receipt in receipts]
    expected_pre_state_digest = sha256_digest(evidence["pre_state"])
    expected_payload_digest = sha256_digest(
        {
            "evidence": evidence,
            "receipt_hashes": expected_receipt_hashes,
        }
    )
    notes: list[str] = []
    verified = True

    if proof["capsule_hash"] != evidence["capsule"]["hash"]:
        verified = False
        notes.append("Capsule hash mismatch.")
    if proof["pre_state_digest"] != expected_pre_state_digest:
        verified = False
        notes.append("Pre-state digest mismatch.")
    if proof["payload_digest"] != expected_payload_digest:
        verified = False
        notes.append("Payload digest mismatch.")
    if proof["receipt_hashes"] != expected_receipt_hashes:
        verified = False
        notes.append("Receipt hashes mismatch.")

    proof["verified"] = verified
    proof["verification_notes"] = notes
    return proof
