from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from .validation import ensure_hex_address


class TokenDefinition(BaseModel):
    address: str
    decimals: int = Field(default=18, ge=0, le=36)
    kind: str = "erc20"

    @field_validator("address")
    @classmethod
    def validate_address(cls, value: str) -> str:
        return ensure_hex_address(value, field_name="token.address")


class ManualQuoteConfig(BaseModel):
    route_name: str
    token_in_symbol: str
    token_out_symbol: str = "WETH"
    amount_in_units: float = Field(gt=0)
    expected_out_eth: float = Field(gt=0)
    max_slippage_bps: int = Field(default=50, ge=0, le=10_000)
    gas_estimate: int = Field(default=210_000, gt=0)
    gas_price_wei: int | None = Field(default=None, ge=0)
    notes: list[str] = Field(default_factory=list)


class TokensConfig(BaseModel):
    chain_id: int = Field(default=8453, gt=0)
    tokens: dict[str, TokenDefinition]
    manual_quote: ManualQuoteConfig | None = None


class TreasuryConfig(BaseModel):
    chain_id: int = Field(default=8453, gt=0)
    chain_name: str = "Base"
    treasury_wallet_address: str
    monitored_wallet_address: str
    executor_wallet_address: str
    operator_wallet_address: str
    refuel_wallets: list[str] = Field(default_factory=list)
    offline_balances: dict[str, dict[str, float]] = Field(default_factory=dict)

    @field_validator(
        "treasury_wallet_address",
        "monitored_wallet_address",
        "executor_wallet_address",
        "operator_wallet_address",
    )
    @classmethod
    def validate_address(cls, value: str, info: Any) -> str:
        return ensure_hex_address(value, field_name=info.field_name)

    @field_validator("refuel_wallets")
    @classmethod
    def validate_refuel_wallets(cls, values: list[str]) -> list[str]:
        return [ensure_hex_address(value, field_name="refuel_wallet") for value in values]


class SoulCapsuleConfig(BaseModel):
    version: str
    chain_allowlist: list[int]
    dex_route_allowlist: list[str]
    token_allowlist: list[str]
    max_slippage_bps: int = Field(ge=0, le=10_000)
    max_gas_gwei: float = Field(ge=0)
    treasury_reserve_eth: float = Field(ge=0)
    executor_refuel_floor_eth: float = Field(ge=0)
    proof_required: bool = True
    emergency_pause: bool = False
    herodotus: "HerodotusConfig" = Field(default_factory=lambda: HerodotusConfig())


class HerodotusIndexerConfig(BaseModel):
    enabled: bool = True
    base_url: str = "https://rs-indexer.api.herodotus.cloud"
    healthcheck_path: str = "/is-alive"
    block_header_by_timestamp_path: str = "/remappers/get-block-header-by-timestamp"
    chain_id: str | None = None
    supported_chain_ids: list[str] = Field(
        default_factory=lambda: [
            "1",
            "11155111",
            "137",
            "280",
            "MADARA_PRAGMA",
            "STARKNET",
            "SN_SEPOLIA",
            "300",
            "11155420",
            "421614",
            "4801",
            "84532",
            "UNKNOWN",
        ]
    )

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        from .validation import ensure_http_url

        return ensure_http_url(value, field_name="herodotus.indexer.base_url")


class SatelliteContractsConfig(BaseModel):
    enabled: bool = True
    environment: str = "prod"
    manifest_url: str = "https://raw.githubusercontent.com/HerodotusDev/satellite/main/deployments/prod.json"
    chain_id: int | None = None
    contract_address: str | None = None
    safe_reads_required: bool = True
    interface_path: str = "@HerodotusDev/satellite/solidity/src/interfaces/ISatellite.sol"
    read_selector: str = "accountFieldSafe"

    @field_validator("manifest_url")
    @classmethod
    def validate_manifest_url(cls, value: str) -> str:
        from .validation import ensure_http_url

        return ensure_http_url(value, field_name="herodotus.satellite.manifest_url")

    @field_validator("contract_address")
    @classmethod
    def validate_contract_address(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return ensure_hex_address(value, field_name="herodotus.satellite.contract_address")


class HerodotusConfig(BaseModel):
    enabled: bool = True
    proof_validation_required: bool = True
    indexer: HerodotusIndexerConfig = Field(default_factory=HerodotusIndexerConfig)
    satellite: SatelliteContractsConfig = Field(default_factory=SatelliteContractsConfig)


class WalletPolicyConfig(BaseModel):
    roles: dict[str, str]
    allowed_destinations: list[str]
    allowed_tokens: list[str]
    max_spend_per_cycle_eth: float = Field(gt=0)
    local_execution_enabled: bool = False

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, values: dict[str, str]) -> dict[str, str]:
        return {key: ensure_hex_address(value, field_name=f"roles.{key}") for key, value in values.items()}

    @field_validator("allowed_destinations")
    @classmethod
    def validate_destinations(cls, values: list[str]) -> list[str]:
        return [ensure_hex_address(value, field_name="allowed_destinations") for value in values]
