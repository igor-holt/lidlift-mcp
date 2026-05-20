from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .chat_providers import anthropic_chat, openai_chat
from .config import CONFIG
from .data_sources import get_payload
from .thrml_bridge import run_ising_demo
from services.common.config import load_treasury_config, runtime_settings
from services.common.rpc import BaseRpcClient
from services.common.validation import now_utc_iso, wei_to_eth
from services.executor.policy_checks import assert_safe_startup, authorize_bearer_token
from services.reporting.overview import build_proof_first_overview, load_cycle_evidence, load_qflop_backfill_context

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

assert_safe_startup()

app = FastAPI(title="Genesis Conductor Console", version="0.1.0")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class ChatMessage(BaseModel):
    role: str = "user"
    content: str


class ChatRequest(BaseModel):
    prompt: str | None = None
    messages: list[ChatMessage] | None = None
    model: str | None = None
    temperature: float | None = None
    api_key: str | None = None
    max_tokens: int | None = None


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/proof-first")
async def proof_first_index() -> FileResponse:
    return FileResponse(STATIC_DIR / "proof-first.html")


@app.get("/robots.txt")
async def robots() -> FileResponse:
    return FileResponse(STATIC_DIR / "robots.txt")


@app.get("/sitemap.xml")
async def sitemap() -> FileResponse:
    return FileResponse(STATIC_DIR / "sitemap.xml")


@app.get("/api/config")
async def config():
    return {
        "default_source": CONFIG.data_source_default,
        "remote_base": CONFIG.remote_seismic_base,
        "allow_remote_override": CONFIG.allow_remote_override,
    }


@app.get("/api/integrations/status")
async def integrations_status():
    return {
        "openai": {
            "enabled": bool(CONFIG.openai_api_key),
            "model": CONFIG.openai_model,
        },
        "anthropic": {
            "enabled": bool(CONFIG.anthropic_api_key),
            "model": CONFIG.anthropic_model,
            "version": CONFIG.anthropic_version,
        },
    }


@app.get("/api/health")
async def health(
    source: Literal["auto", "live", "local"] = Query(CONFIG.data_source_default),
    base_url: str | None = Query(None),
):
    payload = await get_payload(source, override_base=base_url)
    return payload.health


@app.get("/api/bench/live")
async def bench_live(
    source: Literal["auto", "live", "local"] = Query(CONFIG.data_source_default),
    base_url: str | None = Query(None),
):
    payload = await get_payload(source, override_base=base_url)
    return payload.bench


@app.get("/api/seismic/status")
async def seismic_status(
    source: Literal["auto", "live", "local"] = Query(CONFIG.data_source_default),
    base_url: str | None = Query(None),
):
    payload = await get_payload(source, override_base=base_url)
    return payload.seismic


@app.get("/api/dashboard")
async def dashboard(
    source: Literal["auto", "live", "local"] = Query(CONFIG.data_source_default),
    base_url: str | None = Query(None),
):
    payload = await get_payload(source, override_base=base_url)
    return {
        "requested_source": source,
        "resolved_source": payload.source,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "health": payload.health,
        "bench": payload.bench,
        "seismic": payload.seismic,
    }


@app.get("/api/proof-first/overview")
async def proof_first_overview():
    try:
        return await build_proof_first_overview()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/proof-first/evidence/{cycle_id}")
async def proof_first_evidence(cycle_id: str):
    payload = load_cycle_evidence(cycle_id)
    if not payload:
        raise HTTPException(status_code=404, detail=f"No evidence found for cycle {cycle_id}")
    return payload


@app.get("/api/proof-first/qflop-backfill")
async def proof_first_qflop_backfill():
    return load_qflop_backfill_context()


@app.get("/api/balance")
async def balance(authorization: str | None = Header(default=None)):
    settings = runtime_settings()
    if not authorize_bearer_token(authorization, settings.readonly_api_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not settings.base_rpc_url:
        raise HTTPException(status_code=503, detail="BASE_RPC_URL is not configured")

    treasury = load_treasury_config()
    client = BaseRpcClient(settings.base_rpc_url)
    try:
        balance_wei = await client.get_balance(treasury.monitored_wallet_address)
        block_number = await client.get_block_number()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "monitored_wallet_address": treasury.monitored_wallet_address,
        "chain": {
            "chain_id": treasury.chain_id,
            "chain_name": treasury.chain_name,
            "block_number": block_number,
        },
        "wei_balance": str(balance_wei),
        "eth_balance": wei_to_eth(balance_wei),
        "rpc_source": "env:BASE_RPC_URL",
        "timestamp": now_utc_iso(),
    }


@app.post("/api/chat/openai")
async def chat_openai(request: ChatRequest):
    try:
        result = await openai_chat(
            messages=[m.model_dump() for m in request.messages] if request.messages else None,
            prompt=request.prompt,
            api_key=request.api_key,
            model=request.model,
            temperature=request.temperature,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/chat/anthropic")
async def chat_anthropic(request: ChatRequest):
    try:
        result = await anthropic_chat(
            messages=[m.model_dump() for m in request.messages] if request.messages else None,
            prompt=request.prompt,
            api_key=request.api_key,
            model=request.model,
            max_tokens=request.max_tokens or 512,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text if exc.response is not None else str(exc)
        raise HTTPException(status_code=502, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/thrml/demo")
async def thrml_demo():
    return run_ising_demo()
