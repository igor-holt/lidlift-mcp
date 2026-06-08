from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

from app.main import app
from services.ambient_submit.main import generate_candidate_cycle
from services.bookkeeper.reconcile import reconcile_cycle, simulate_post_state
from services.common.artifacts import upsert_cycle_record
from services.common.rpc import BaseRpcClient
from services.prover.prove_cycle import create_cycle_proof
from services.prover.verify_cycle import verify_cycle_proof


async def _fake_get_balance(self, address):  # noqa: ARG001
    return 1_500_000_000_000_000_000


async def _fake_get_block_number(self):
    return 12_345_678


async def _fake_get_gas_price(self):
    return 7_000_000


async def _fake_get_erc20_balance(self, token_address, wallet_address):  # noqa: ARG001
    return 250_000_000_000_000_000


async def _fake_build_herodotus_context(**kwargs):  # noqa: ARG001
    return {
        "status": "ready",
        "proof_validation_required": True,
        "verified_for_consumption": False,
        "summary": "Satellite resolved and indexer candidate planned.",
        "reference_timestamp": 1_742_707_200,
        "indexer": {
            "status": "ready",
            "chain_id": "84532",
            "candidate": {"block_number": 123, "block_hash": "0xabc", "timestamp": 1_742_707_200},
            "provenance": {
                "endpoint": "https://rs-indexer.api.herodotus.cloud/remappers/get-block-header-by-timestamp",
                "params": {"timestamp": 1_742_707_200, "chain_id": "84532"},
                "response_version": "docs-2026-04-10",
                "executed": True,
            },
        },
        "satellite": {
            "status": "resolved",
            "chain_id": 8453,
            "contract_address": "0xb036f7Bdd9C7A5984323f148064f815f4C75174b",
            "safe_reads_required": True,
        },
    }


def test_balance_endpoint_requires_bearer_token(workspace, monkeypatch):
    monkeypatch.setenv("READONLY_API_TOKEN", "proof-token")
    monkeypatch.setenv("BASE_RPC_URL", "https://rpc.example")
    monkeypatch.setattr(BaseRpcClient, "get_balance", _fake_get_balance)
    monkeypatch.setattr(BaseRpcClient, "get_block_number", _fake_get_block_number)

    client = TestClient(app)

    unauthorized = client.get("/api/balance")
    authorized = client.get("/api/balance", headers={"Authorization": "Bearer proof-token"})

    assert unauthorized.status_code == 401
    assert authorized.status_code == 200
    assert authorized.json()["eth_balance"] == "1.500000000000"


def test_overview_and_evidence_endpoints(workspace, monkeypatch):
    monkeypatch.setenv("BASE_RPC_URL", "https://rpc.example")
    monkeypatch.setattr(BaseRpcClient, "get_balance", _fake_get_balance)
    monkeypatch.setattr(BaseRpcClient, "get_block_number", _fake_get_block_number)
    monkeypatch.setattr(BaseRpcClient, "get_gas_price", _fake_get_gas_price)
    monkeypatch.setattr(BaseRpcClient, "get_erc20_balance", _fake_get_erc20_balance)
    monkeypatch.setattr("services.ambient_submit.main.herodotus_integration.build_herodotus_context", _fake_build_herodotus_context)
    monkeypatch.setattr("services.reporting.overview.herodotus_integration.build_herodotus_context", _fake_build_herodotus_context)

    evidence = asyncio.run(generate_candidate_cycle(dry_run=True))
    receipts = [{"step": "swap", "status": "simulated"}]
    proof = create_cycle_proof(evidence, receipts)
    proof = verify_cycle_proof(evidence, proof, receipts)
    post_state = simulate_post_state(evidence["pre_state"], delta_eth=evidence["quote"]["expected_delta_eth"])
    closing_report = reconcile_cycle(
        evidence["pre_state"],
        receipts,
        post_state,
        expected_delta_eth=evidence["quote"]["expected_delta_eth"],
        mode="dry_run",
    )
    upsert_cycle_record(evidence["cycle_id"], evidence=evidence, proof=proof, closing_report=closing_report)

    client = TestClient(app)

    overview = client.get("/api/proof-first/overview")
    evidence_response = client.get(f"/api/proof-first/evidence/{evidence['cycle_id']}")

    assert overview.status_code == 200
    assert overview.json()["latest_cycle_id"] == evidence["cycle_id"]
    assert overview.json()["wallet_balances"]["treasury"]["native_eth"] == "1.500000000000"
    assert overview.json()["herodotus"]["satellite"]["contract_address"] == "0xb036f7Bdd9C7A5984323f148064f815f4C75174b"

    assert evidence_response.status_code == 200
    assert evidence_response.json()["proof"]["verified"] is True
