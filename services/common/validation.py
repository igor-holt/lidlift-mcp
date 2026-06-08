from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN
from typing import Any
from urllib.parse import urlparse

HEX_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
HEX_PRIVATE_KEY_RE = re.compile(r"^(0x)?[a-fA-F0-9]{64}$")
PLACEHOLDER_PATTERNS = (
    "changeme",
    "replace-me",
    "example",
    "placeholder",
    "your-",
    "set-me",
)


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_json_dumps(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha256_digest(payload: Any) -> str:
    if not isinstance(payload, str):
        payload = stable_json_dumps(payload)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def ensure_hex_address(value: str, *, field_name: str) -> str:
    if not HEX_ADDRESS_RE.match(value):
        raise ValueError(f"{field_name} must be a 0x-prefixed 40-byte hex address")
    return value


def ensure_http_url(value: str, *, field_name: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"{field_name} must be an http(s) URL")
    return value


def ensure_not_placeholder(value: str, *, field_name: str) -> str:
    lowered = value.strip().lower()
    if not lowered:
        raise ValueError(f"{field_name} must not be empty")
    if any(marker in lowered for marker in PLACEHOLDER_PATTERNS):
        raise ValueError(f"{field_name} must not use a placeholder value")
    return value


def wei_to_eth(wei_value: int) -> str:
    quantized = (Decimal(wei_value) / Decimal("1000000000000000000")).quantize(
        Decimal("0.000000000001"), rounding=ROUND_DOWN
    )
    return format(quantized, "f")


def eth_to_wei(eth_value: float | int | str) -> int:
    return int((Decimal(str(eth_value)) * Decimal("1000000000000000000")).to_integral_value())


def contains_secret_material(value: str) -> bool:
    lowered = value.lower()
    return bool(
        HEX_PRIVATE_KEY_RE.match(value.strip())
        or "-----begin" in lowered
        or "api_key" in lowered
        or "private_key" in lowered
        or "seed phrase" in lowered
    )
