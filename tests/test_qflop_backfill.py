from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from services.common.qflop_backfill import build_qflop_backfill_context


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")


def _fake_qflop_root(root: Path) -> Path:
    qflop = root / "qflop-backfill"
    proof = {
        "proof_id": "proof-0-99",
        "batch_qflop": 3_600_000,
        "trace_length": 1_048_576,
        "stark_proof_hash": "0xabc",
        "trace_commitments": ["a", "b"],
        "prove_time_ms": 401,
        "prover_wallet": 0,
        "ts": "2026-05-19T12:00:00Z",
    }
    _write_jsonl(qflop / "logs" / "vdf_proof_queue.jsonl", [proof])
    _write_json(
        qflop / "logs" / "backfill_state.json",
        {
            "session_start": "2026-05-19T12:00:00Z",
            "total_wraps": 12,
            "total_qflop": 43_200_000,
            "total_revenue_usd": 6.48,
            "total_gas_eth": 0.001,
            "wallets_active": 4,
            "architecture": "alternating_vdf_v8",
            "proofs_generated": 13,
            "proofs_consumed": 12,
            "wallet_stats": {"0": {"wraps": 3}},
        },
    )
    _write_json(qflop / "logs" / "consumed_proofs.json", ["proof-0-98", "proof-0-99"])
    _write_jsonl(qflop / "artifacts" / "celestial_bodies.jsonl", [{"id": "wallet::backfill-0"}])
    (qflop / "logs" / "harvest.log").write_text("[harvest] Treasury wQFLOP: 0.0\n", encoding="utf-8")
    (qflop / "logs" / "refuel.log").write_text(
        "[refuel] Treasury ETH too low for recirculation: 0.000001\n",
        encoding="utf-8",
    )
    (qflop / "logs" / "orchestrator_v8.2_pareto.log").write_text(
        "[WRAP] #12 | $6.48 | 0xabc...\n",
        encoding="utf-8",
    )
    (qflop / "orchestrator").mkdir(parents=True, exist_ok=True)
    (qflop / "orchestrator" / "attestor_client.mjs").write_text(
        "event TickArmed(bytes32 indexed cycleId)\n",
        encoding="utf-8",
    )
    (qflop / "package.json").write_text('{"name":"qflop-backfill"}\n', encoding="utf-8")
    return qflop


def test_qflop_context_imports_runtime_without_revenue_claim(workspace, monkeypatch):
    qflop = _fake_qflop_root(workspace)
    monkeypatch.setenv("QFLOP_BACKFILL_ROOT", str(qflop))
    monkeypatch.setenv("QFLOP_PROOF_STALE_HOURS", "100000")

    payload = build_qflop_backfill_context()

    assert payload["status"] == "ready"
    assert payload["source"]["read_secret_files"] is False
    assert payload["latest_vdf_proof"]["proof_id"] == "proof-0-99"
    assert payload["backfill_state"]["total_wraps"] == 12
    assert payload["verification"]["qflop_vdf_proof_observed"] is True
    assert payload["verification"]["counts_as_revenue"] is False


def test_qflop_endpoint_reports_missing_source(workspace, monkeypatch):
    missing = workspace / "missing-qflop"
    monkeypatch.setenv("QFLOP_BACKFILL_ROOT", str(missing))

    client = TestClient(app)
    response = client.get("/api/proof-first/qflop-backfill")

    assert response.status_code == 200
    assert response.json()["status"] == "missing"
