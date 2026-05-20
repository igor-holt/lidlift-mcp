from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import validate

from .paths import schemas_dir


def load_schema(schema_name: str) -> dict[str, Any]:
    target = schemas_dir() / schema_name
    with target.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_payload(schema_name: str, payload: dict[str, Any]) -> None:
    validate(instance=payload, schema=load_schema(schema_name))
