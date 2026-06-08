from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from .models import HerodotusConfig, TreasuryConfig

DOCS_RESPONSE_VERSION = "docs-2026-04-10"


def _join_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _unix_timestamp(timestamp_iso: str) -> int:
    normalized = timestamp_iso.replace("Z", "+00:00")
    return int(datetime.fromisoformat(normalized).timestamp())


async def _fetch_json(url: str, *, params: dict[str, Any] | None = None) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        return response.json()


async def _fetch_health(url: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            payload = response.json()
            return {
                "ok": True,
                "message": payload.get("message", "Alive"),
                "status_code": response.status_code,
            }
        return {
            "ok": True,
            "message": response.text.strip() or "Alive",
            "status_code": response.status_code,
        }


async def build_herodotus_context(
    *,
    herodotus: HerodotusConfig,
    treasury: TreasuryConfig,
    reference_timestamp_iso: str,
) -> dict[str, Any]:
    if not herodotus.enabled:
        return {
            "status": "disabled",
            "proof_validation_required": False,
            "verified_for_consumption": False,
            "summary": "Herodotus integration is disabled in the soul capsule.",
            "reference_timestamp": _unix_timestamp(reference_timestamp_iso),
            "indexer": {"status": "disabled"},
            "satellite": {"status": "disabled"},
        }

    indexer = await _resolve_indexer_context(
        herodotus=herodotus,
        treasury=treasury,
        reference_timestamp_iso=reference_timestamp_iso,
    )
    satellite = await _resolve_satellite_context(herodotus=herodotus, treasury=treasury)

    if satellite["status"] != "resolved":
        status = "degraded"
    elif indexer["status"] == "ready":
        status = "ready"
    else:
        status = "guarded"

    return {
        "status": status,
        "proof_validation_required": herodotus.proof_validation_required,
        "verified_for_consumption": False,
        "summary": _compose_summary(indexer=indexer, satellite=satellite),
        "reference_timestamp": _unix_timestamp(reference_timestamp_iso),
        "indexer": indexer,
        "satellite": satellite,
    }


async def _resolve_indexer_context(
    *,
    herodotus: HerodotusConfig,
    treasury: TreasuryConfig,
    reference_timestamp_iso: str,
) -> dict[str, Any]:
    config = herodotus.indexer
    if not config.enabled:
        return {
            "status": "disabled",
            "reason": "Data Structure Indexer integration is disabled.",
        }

    chain_id = config.chain_id or str(treasury.chain_id)
    reference_timestamp = _unix_timestamp(reference_timestamp_iso)
    health_url = _join_url(config.base_url, config.healthcheck_path)
    query_url = _join_url(config.base_url, config.block_header_by_timestamp_path)
    provenance = {
        "endpoint": query_url,
        "params": {
            "timestamp": reference_timestamp,
            "chain_id": chain_id,
        },
        "response_version": DOCS_RESPONSE_VERSION,
        "executed": False,
    }

    try:
        health = await _fetch_health(health_url)
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "degraded",
            "chain_id": chain_id,
            "health": {"ok": False, "message": str(exc)},
            "candidate": None,
            "provenance": provenance,
            "reason": f"Indexer health check failed: {exc}",
            "supported_chain_ids": config.supported_chain_ids,
        }

    if chain_id not in config.supported_chain_ids:
        return {
            "status": "blocked",
            "chain_id": chain_id,
            "health": health,
            "candidate": None,
            "provenance": provenance,
            "reason": (
                f"Chain {chain_id} is not listed in the Herodotus Data Structure Indexer docs for remapper "
                "timestamp resolution. Candidate planning stays unverified until a supported remapper chain is configured."
            ),
            "supported_chain_ids": config.supported_chain_ids,
        }

    try:
        payload = await _fetch_json(query_url, params=provenance["params"])
        provenance["executed"] = True
        block_header = payload.get("block_header", {})
        candidate = {
            "block_number": block_header.get("block_number"),
            "block_hash": block_header.get("block_hash"),
            "timestamp": block_header.get("timestamp"),
            "state_root": block_header.get("state_root"),
        }
        if candidate["block_number"] is None:
            raise ValueError("block_header.block_number missing from response")
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "degraded",
            "chain_id": chain_id,
            "health": health,
            "candidate": None,
            "provenance": provenance,
            "reason": f"Indexer candidate query failed: {exc}",
            "supported_chain_ids": config.supported_chain_ids,
        }

    return {
        "status": "ready",
        "chain_id": chain_id,
        "health": health,
        "candidate": candidate,
        "provenance": provenance,
        "supported_chain_ids": config.supported_chain_ids,
    }


async def _resolve_satellite_context(
    *,
    herodotus: HerodotusConfig,
    treasury: TreasuryConfig,
) -> dict[str, Any]:
    config = herodotus.satellite
    if not config.enabled:
        return {
            "status": "disabled",
            "reason": "Satellite integration is disabled.",
        }

    chain_id = config.chain_id or treasury.chain_id
    if config.contract_address:
        return {
            "status": "resolved",
            "chain_id": chain_id,
            "contract_address": config.contract_address,
            "environment": config.environment,
            "manifest_url": config.manifest_url,
            "connections": [],
            "safe_reads_required": config.safe_reads_required,
            "interface_path": config.interface_path,
            "read_selector": config.read_selector,
            "resolution_source": "config_override",
        }

    try:
        payload = await _fetch_json(config.manifest_url)
        entry = payload.get("satellites", {}).get(str(chain_id))
        if not entry or not entry.get("contractAddress"):
            raise ValueError(f"No Satellite deployment found for chain {chain_id}")
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "degraded",
            "chain_id": chain_id,
            "environment": config.environment,
            "manifest_url": config.manifest_url,
            "contract_address": None,
            "connections": [],
            "safe_reads_required": config.safe_reads_required,
            "interface_path": config.interface_path,
            "read_selector": config.read_selector,
            "reason": f"Satellite resolution failed: {exc}",
        }

    return {
        "status": "resolved",
        "chain_id": chain_id,
        "environment": config.environment,
        "manifest_url": config.manifest_url,
        "contract_address": entry["contractAddress"],
        "connections": sorted((entry.get("connections") or {}).keys()),
        "safe_reads_required": config.safe_reads_required,
        "interface_path": config.interface_path,
        "read_selector": config.read_selector,
        "resolution_source": "manifest",
    }


def _compose_summary(*, indexer: dict[str, Any], satellite: dict[str, Any]) -> str:
    parts: list[str] = []
    satellite_address = satellite.get("contract_address")
    if satellite_address:
        parts.append(f"Satellite resolved for chain {satellite.get('chain_id')}: {satellite_address}.")
    else:
        parts.append(satellite.get("reason", "Satellite resolution is unavailable."))

    if indexer.get("status") == "ready":
        candidate = indexer.get("candidate") or {}
        parts.append(
            f"Indexer candidate resolved at block {candidate.get('block_number')} for chain {indexer.get('chain_id')}."
        )
    else:
        parts.append(indexer.get("reason", "Indexer candidate planning is not ready."))

    parts.append("Downstream consumption remains guarded until proof-backed validation succeeds.")
    return " ".join(part for part in parts if part)
