from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .paths import ensure_runtime_dirs, inputs_dir, proofs_dir, reports_dir
from .schema import validate_payload
from .validation import now_utc_iso


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_latest_evidence(payload: dict[str, Any]) -> None:
    ensure_runtime_dirs()
    validate_payload("evidence.schema.json", payload)
    _write_json(inputs_dir() / "evidence.json", payload)


def read_latest_evidence() -> dict[str, Any] | None:
    return _read_json(inputs_dir() / "evidence.json")


def write_proof(cycle_id: str, payload: dict[str, Any]) -> None:
    ensure_runtime_dirs()
    validate_payload("cycle_proof.schema.json", payload)
    _write_json(proofs_dir() / f"{cycle_id}.json", payload)
    _write_json(proofs_dir() / "latest.json", payload)


def read_proof(cycle_id: str) -> dict[str, Any] | None:
    return _read_json(proofs_dir() / f"{cycle_id}.json")


def upsert_cycle_record(
    cycle_id: str,
    *,
    evidence: dict[str, Any] | None = None,
    proof: dict[str, Any] | None = None,
    closing_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ensure_runtime_dirs()
    path = reports_dir() / f"{cycle_id}.json"
    current = _read_json(path) or {"cycle_id": cycle_id}
    if evidence is not None:
        current["evidence"] = evidence
    if proof is not None:
        current["proof"] = proof
    if closing_report is not None:
        current["closing_report"] = closing_report
    current["updated_at"] = now_utc_iso()
    _write_json(path, current)
    _write_json(reports_dir() / "latest.json", current)
    return current


def read_cycle_record(cycle_id: str) -> dict[str, Any] | None:
    return _read_json(reports_dir() / f"{cycle_id}.json")


def read_latest_cycle_record() -> dict[str, Any] | None:
    return _read_json(reports_dir() / "latest.json")
