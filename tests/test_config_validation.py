from __future__ import annotations

from services.common.config import capsule_hash, load_soul_capsule, load_wallet_policy
from services.executor.policy_checks import startup_security_summary


def test_capsule_hash_and_policy_load(workspace):
    capsule = load_soul_capsule()
    policy = load_wallet_policy()

    assert capsule.version == "2026-04-10"
    assert len(capsule_hash(capsule)) == 64
    assert policy.roles["treasury"].startswith("0x")
    assert policy.allowed_tokens == ["WETH", "FEE_TOKEN"]
    assert capsule.herodotus.satellite.chain_id == 8453
    assert capsule.herodotus.indexer.base_url.startswith("https://")


def test_placeholder_token_is_rejected(workspace, monkeypatch):
    monkeypatch.setenv("READONLY_API_TOKEN", "replace-me")

    issues = startup_security_summary()

    assert any("READONLY_API_TOKEN" in issue for issue in issues)
