from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.common.paths import inputs_dir, proofs_dir, schemas_dir
from services.common.schema import validate_payload


def validate_json_file(path: Path) -> None:
    with path.open("r", encoding="utf-8") as handle:
        json.load(handle)


def main() -> int:
    for schema in schemas_dir().glob("*.json"):
        validate_json_file(schema)

    evidence_file = inputs_dir() / "evidence.json"
    if evidence_file.exists():
        with evidence_file.open("r", encoding="utf-8") as handle:
            validate_payload("evidence.schema.json", json.load(handle))

    latest_proof = proofs_dir() / "latest.json"
    if latest_proof.exists():
        with latest_proof.open("r", encoding="utf-8") as handle:
            validate_payload("cycle_proof.schema.json", json.load(handle))

    print("schema validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
