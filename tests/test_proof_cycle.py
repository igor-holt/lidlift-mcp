from __future__ import annotations

import asyncio
import json

from services.ambient_submit.main import generate_candidate_cycle
from services.common.artifacts import read_latest_evidence
from services.prover.prove_cycle import create_cycle_proof
from services.prover.verify_cycle import verify_cycle_proof


async def _fake_build_herodotus_context(**kwargs):  # noqa: ARG001
    return {
        "status": "guarded",
        "proof_validation_required": True,
        "verified_for_consumption": False,
        "summary": "Satellite resolved, but remapper planning for Base mainnet is not documented.",
        "reference_timestamp": 1_742_707_200,
        "indexer": {
            "status": "blocked",
            "chain_id": "8453",
            "candidate": None,
            "provenance": {
                "endpoint": "https://rs-indexer.api.herodotus.cloud/remappers/get-block-header-by-timestamp",
                "params": {"timestamp": 1_742_707_200, "chain_id": "8453"},
                "response_version": "docs-2026-04-10",
                "executed": False,
            },
        },
        "satellite": {
            "status": "resolved",
            "chain_id": 8453,
            "contract_address": "0xb036f7Bdd9C7A5984323f148064f815f4C75174b",
            "safe_reads_required": True,
        },
    }


def test_evidence_and_proof_round_trip(workspace, monkeypatch):
    monkeypatch.setattr("services.ambient_submit.main.herodotus_integration.build_herodotus_context", _fake_build_herodotus_context)
    evidence = asyncio.run(generate_candidate_cycle(dry_run=True))
    saved_evidence = read_latest_evidence()

    assert saved_evidence is not None
    assert saved_evidence["cycle_id"] == evidence["cycle_id"]
    assert saved_evidence["policy_state"]["admissible"] is True
    assert saved_evidence["herodotus"]["satellite"]["contract_address"] == "0xb036f7Bdd9C7A5984323f148064f815f4C75174b"

    proof = create_cycle_proof(evidence, [])
    verified = verify_cycle_proof(evidence, proof, [])

    assert verified["verified"] is True
    assert verified["payload_digest"]


def test_proof_verification_detects_tampering(workspace, monkeypatch):
    monkeypatch.setattr("services.ambient_submit.main.herodotus_integration.build_herodotus_context", _fake_build_herodotus_context)
    evidence = asyncio.run(generate_candidate_cycle(dry_run=True))
    proof = create_cycle_proof(evidence, [])
    proof["payload_digest"] = "broken"

    verified = verify_cycle_proof(evidence, proof, [])

    assert verified["verified"] is False
    assert "Payload digest mismatch." in verified["verification_notes"]
