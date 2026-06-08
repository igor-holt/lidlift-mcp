from __future__ import annotations

import asyncio
from typing import Any

import httpx

from .validation import ensure_hex_address, now_utc_iso


class RpcError(RuntimeError):
    """Raised when the JSON-RPC endpoint returns an invalid response."""


class BaseRpcClient:
    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self.base_url = base_url
        self.timeout = timeout

    async def call(self, method: str, params: list[Any]) -> Any:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self.base_url,
                json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
                headers={"Content-Type": "application/json"},
            )
        response.raise_for_status()
        payload = response.json()
        if "error" in payload:
            raise RpcError(str(payload["error"]))
        if "result" not in payload:
            raise RpcError(f"Missing result for method {method}")
        return payload["result"]

    async def get_block_number(self) -> int:
        return int(await self.call("eth_blockNumber", []), 16)

    async def get_gas_price(self) -> int:
        return int(await self.call("eth_gasPrice", []), 16)

    async def get_balance(self, address: str) -> int:
        ensure_hex_address(address, field_name="address")
        return int(await self.call("eth_getBalance", [address, "latest"]), 16)

    async def get_erc20_balance(self, token_address: str, wallet_address: str) -> int:
        ensure_hex_address(token_address, field_name="token_address")
        ensure_hex_address(wallet_address, field_name="wallet_address")
        encoded_address = wallet_address.removeprefix("0x").rjust(64, "0")
        data = f"0x70a08231{encoded_address}"
        result = await self.call(
            "eth_call",
            [{"to": token_address, "data": data}, "latest"],
        )
        if result in {"0x", "0X", None}:
            return 0
        return int(result, 16)

    async def send_raw_transaction(self, raw_transaction: str) -> str:
        return await self.call("eth_sendRawTransaction", [raw_transaction])

    async def get_transaction_receipt(self, tx_hash: str) -> dict[str, Any] | None:
        return await self.call("eth_getTransactionReceipt", [tx_hash])

    async def wait_for_receipt(self, tx_hash: str, *, attempts: int = 15, sleep_seconds: float = 1.0) -> dict[str, Any]:
        for _ in range(attempts):
            receipt = await self.get_transaction_receipt(tx_hash)
            if receipt:
                return receipt
            await asyncio.sleep(sleep_seconds)
        raise RpcError(f"Timed out waiting for receipt {tx_hash}")


def receipt_record(step: str, *, status: str, source: str, tx_hash: str | None = None, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {
        "step": step,
        "status": status,
        "source": source,
        "tx_hash": tx_hash,
        "created_at": now_utc_iso(),
    }
    if extra:
        payload["extra"] = extra
    return payload
