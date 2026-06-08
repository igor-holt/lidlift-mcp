from __future__ import annotations

from typing import Any, Iterable

import httpx

from .config import CONFIG


def _normalize_messages(messages: Iterable[dict[str, Any]] | None, prompt: str | None) -> list[dict[str, Any]]:
    if messages:
        return [
            {"role": msg.get("role", "user"), "content": msg.get("content", "")}
            for msg in messages
            if msg.get("content")
        ]
    if prompt:
        return [{"role": "user", "content": prompt}]
    return []


def _extract_openai_text(payload: dict[str, Any]) -> str | None:
    output = payload.get("output") or []
    texts: list[str] = []
    for item in output:
        for content in item.get("content", []) or []:
            if content.get("type") == "output_text":
                texts.append(content.get("text", ""))
    if texts:
        return "".join(texts).strip() or None
    return payload.get("output_text")


def _extract_anthropic_text(payload: dict[str, Any]) -> str | None:
    blocks = payload.get("content") or []
    texts: list[str] = []
    for block in blocks:
        if block.get("type") == "text":
            texts.append(block.get("text", ""))
    if texts:
        return "".join(texts).strip() or None
    return None


def _split_anthropic_system(messages: list[dict[str, Any]]) -> tuple[str | None, list[dict[str, Any]]]:
    if not messages:
        return None, []
    if messages[0].get("role") == "system":
        system = messages[0].get("content")
        return system, messages[1:]
    return None, messages


async def openai_chat(
    *,
    messages: Iterable[dict[str, Any]] | None = None,
    prompt: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> dict[str, Any]:
    normalized = _normalize_messages(messages, prompt)
    if not normalized:
        raise ValueError("No prompt supplied")

    key = api_key or CONFIG.openai_api_key
    if not key:
        raise RuntimeError("Missing OPENAI_API_KEY")

    payload: dict[str, Any] = {
        "model": model or CONFIG.openai_model,
        "input": normalized,
    }
    if temperature is not None:
        payload["temperature"] = temperature

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    return {
        "model": payload["model"],
        "text": _extract_openai_text(data),
        "raw": data,
    }


async def anthropic_chat(
    *,
    messages: Iterable[dict[str, Any]] | None = None,
    prompt: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
    max_tokens: int = 512,
) -> dict[str, Any]:
    normalized = _normalize_messages(messages, prompt)
    if not normalized:
        raise ValueError("No prompt supplied")

    key = api_key or CONFIG.anthropic_api_key
    if not key:
        raise RuntimeError("Missing ANTHROPIC_API_KEY")

    system, cleaned = _split_anthropic_system(normalized)

    payload: dict[str, Any] = {
        "model": model or CONFIG.anthropic_model,
        "max_tokens": max_tokens,
        "messages": cleaned,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": key,
                "anthropic-version": CONFIG.anthropic_version,
                "content-type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    return {
        "model": payload["model"],
        "text": _extract_anthropic_text(data),
        "raw": data,
    }
