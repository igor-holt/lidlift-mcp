from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    data_source_default: str
    remote_seismic_base: str
    allow_remote_override: bool
    openai_api_key: str | None
    openai_model: str
    anthropic_api_key: str | None
    anthropic_model: str
    anthropic_version: str


def _bool(val: str) -> bool:
    return val.strip().lower() in ("1", "true", "yes")


CONFIG = Config(
    data_source_default=os.environ.get("DATA_SOURCE", "auto"),
    remote_seismic_base=os.environ.get(
        "REMOTE_SEISMIC_BASE", "https://qmem.genesisconductor.io"
    ),
    allow_remote_override=_bool(os.environ.get("ALLOW_REMOTE_OVERRIDE", "false")),
    openai_api_key=os.environ.get("OPENAI_API_KEY") or None,
    openai_model=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
    anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
    anthropic_model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    anthropic_version=os.environ.get("ANTHROPIC_VERSION", "2023-06-01"),
)
