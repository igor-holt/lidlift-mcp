from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .validation import now_utc_iso, sha256_digest

DEFAULT_QFLOP_ROOTS = (
    Path("/Users/Igor/wQFLOP/qflop-backfill"),
    Path("/Users/Igor/qflop-backfill"),
)
PROOF_REQUIRED_FIELDS = {
    "proof_id",
    "batch_qflop",
    "trace_length",
    "stark_proof_hash",
    "trace_commitments",
    "prove_time_ms",
    "prover_wallet",
    "ts",
}
ATTESTOR_EVENTS = ("TickArmed", "TickReleased", "CycleSettled", "CycleCancelled")
TX_HASH_RE = re.compile(r"0x[a-fA-F0-9]{64}")


def resolve_qflop_backfill_root() -> tuple[Path | None, list[dict[str, Any]]]:
    """Resolve the local qflop-backfill runtime without reading secret-bearing files."""
    candidates: list[tuple[str, Path]] = []
    env_root = os.environ.get("QFLOP_BACKFILL_ROOT")
    if env_root:
        candidates.append(("env:QFLOP_BACKFILL_ROOT", Path(env_root).expanduser()))
    else:
        candidates.extend(("default", root) for root in DEFAULT_QFLOP_ROOTS)

    checked: list[dict[str, Any]] = []
    seen: set[Path] = set()
    for source, raw_root in candidates:
        root = raw_root.resolve()
        if root in seen:
            continue
        seen.add(root)
        logs_dir = root / "logs"
        package_file = root / "package.json"
        valid = (
            logs_dir.is_dir()
            and package_file.is_file()
            and (logs_dir / "vdf_proof_queue.jsonl").is_file()
            and (logs_dir / "backfill_state.json").is_file()
        )
        checked.append(
            {
                "source": source,
                "path": str(root),
                "exists": root.exists(),
                "valid_runtime": valid,
            }
        )
        if valid:
            return root, checked
    return None, checked


def build_qflop_backfill_context() -> dict[str, Any]:
    root, checked_roots = resolve_qflop_backfill_root()
    if root is None:
        return {
            "status": "missing",
            "generated_at": now_utc_iso(),
            "source": {
                "root": None,
                "checked_roots": checked_roots,
                "read_secret_files": False,
            },
            "summary": "No valid qflop-backfill runtime root was found.",
            "verification": _verification_summary(False, False, False, False),
        }

    logs_dir = root / "logs"
    latest_proof = _read_last_jsonl_record(logs_dir / "vdf_proof_queue.jsonl")
    state = _read_json_file(logs_dir / "backfill_state.json") or {}
    consumed = _read_json_file(logs_dir / "consumed_proofs.json")
    celestial_count = _count_lines(root / "artifacts" / "celestial_bodies.jsonl")
    attestor_file = root / "orchestrator" / "attestor_client.mjs"
    git = _git_summary(root)

    proof_valid = _proof_shape_valid(latest_proof)
    proof_stale = _proof_is_stale(latest_proof)
    attestor_present = attestor_file.is_file()
    attestor_receipts_observed = _any_pattern_in_file(
        logs_dir / "orchestrator_v8.2_pareto.log",
        ("attestor_armed", "attestor_released", "attestor_settled", "TickArmed", "CycleSettled"),
    )
    treasury_delta_reconciled = _treasury_delta_reconciled(logs_dir)

    status = "ready"
    findings: list[str] = []
    if not proof_valid:
        status = "degraded"
        findings.append("Latest VDF proof is missing required qflop fields.")
    if proof_stale:
        status = "stale"
        findings.append("Latest VDF proof is stale relative to QFLOP_PROOF_STALE_HOURS.")
    if not attestor_present:
        status = "degraded"
        findings.append("Attestor client source file is missing.")
    if not attestor_receipts_observed:
        findings.append("No attestor lifecycle events were observed in runtime logs.")
    if not treasury_delta_reconciled:
        findings.append("No receipts-backed positive treasury ETH delta was observed in qflop-backfill logs.")

    return {
        "status": status,
        "generated_at": now_utc_iso(),
        "source": {
            "root": str(root),
            "checked_roots": checked_roots,
            "read_secret_files": False,
        },
        "github": git,
        "trust_boundary": (
            "Imported from local qflop-backfill runtime artifacts as read-only evidence. "
            "It is not an execution authority and does not promote Notion pages to proof."
        ),
        "latest_vdf_proof": _proof_summary(latest_proof),
        "backfill_state": _state_summary(state, logs_dir / "backfill_state.json"),
        "proof_consumption": _consumed_summary(consumed, logs_dir / "consumed_proofs.json"),
        "attestor": {
            "client_present": attestor_present,
            "source_path": str(attestor_file) if attestor_present else None,
            "source_digest": _file_digest(attestor_file) if attestor_present else None,
            "events": list(ATTESTOR_EVENTS),
            "lifecycle_events_observed": attestor_receipts_observed,
            "address_source": "runtime env only; .env is intentionally not read",
        },
        "a2a": {
            "celestial_bodies_count": celestial_count,
            "artifact_path": str(root / "artifacts" / "celestial_bodies.jsonl")
            if celestial_count is not None
            else None,
        },
        "runtime_findings": {
            "findings": findings,
            "harvest_tail": _tail_matching_lines(logs_dir / "harvest.log", ("Treasury wQFLOP", "Balance is 0"), 4),
            "refuel_tail": _tail_matching_lines(logs_dir / "refuel.log", ("Treasury ETH too low", "Need refuel"), 4),
            "wrapper_tx_hashes_observed": _count_tx_hashes(logs_dir / "orchestrator_v8.2_pareto.log", max_bytes=512_000),
        },
        "verification": _verification_summary(
            proof_valid,
            not proof_stale,
            attestor_receipts_observed,
            treasury_delta_reconciled,
        ),
        "summary": _summary(status, proof_valid, proof_stale, attestor_receipts_observed, treasury_delta_reconciled),
    }


def _read_json_file(path: Path) -> Any:
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None


def _read_last_jsonl_record(path: Path, *, max_bytes: int = 1_048_576) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            handle.seek(max(0, size - max_bytes))
            chunk = handle.read().decode("utf-8", errors="replace")
    except OSError:
        return None
    for line in reversed(chunk.splitlines()):
        stripped = line.strip()
        if not stripped:
            continue
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def _proof_shape_valid(proof: dict[str, Any] | None) -> bool:
    return bool(proof and PROOF_REQUIRED_FIELDS.issubset(proof.keys()))


def _proof_summary(proof: dict[str, Any] | None) -> dict[str, Any]:
    if not proof:
        return {
            "present": False,
            "valid_shape": False,
            "digest": None,
        }
    return {
        "present": True,
        "valid_shape": _proof_shape_valid(proof),
        "digest": sha256_digest(proof),
        "proof_id": proof.get("proof_id"),
        "batch_qflop": proof.get("batch_qflop"),
        "trace_length": proof.get("trace_length"),
        "stark_proof_hash": proof.get("stark_proof_hash"),
        "trace_commitments": proof.get("trace_commitments"),
        "prove_time_ms": proof.get("prove_time_ms"),
        "prover_wallet": proof.get("prover_wallet"),
        "ts": proof.get("ts"),
        "stale": _proof_is_stale(proof),
    }


def _proof_is_stale(proof: dict[str, Any] | None) -> bool:
    if not proof or not proof.get("ts"):
        return True
    stale_hours = float(os.environ.get("QFLOP_PROOF_STALE_HOURS", "24"))
    try:
        ts = datetime.fromisoformat(str(proof["ts"]).replace("Z", "+00:00"))
    try:
        stale_hours = float(os.environ.get("QFLOP_PROOF_STALE_HOURS", "24"))
    except ValueError:
        stale_hours = 24.0
        return True
    age_seconds = (datetime.now(timezone.utc) - ts.astimezone(timezone.utc)).total_seconds()
    return age_seconds > stale_hours * 3600


def _state_summary(state: dict[str, Any], path: Path) -> dict[str, Any]:
    wallet_stats = state.get("wallet_stats") if isinstance(state.get("wallet_stats"), dict) else {}
    return {
        "present": bool(state),
        "source_path": str(path) if path.exists() else None,
        "source_digest": _file_digest(path) if path.exists() else None,
        "session_start": state.get("session_start"),
        "architecture": state.get("architecture"),
        "total_wraps": state.get("total_wraps"),
        "total_qflop": state.get("total_qflop"),
        "total_revenue_usd": state.get("total_revenue_usd"),
        "total_gas_eth": state.get("total_gas_eth"),
        "wallets_active": state.get("wallets_active"),
        "proofs_generated": state.get("proofs_generated"),
        "proofs_consumed": state.get("proofs_consumed"),
        "total_proofs": state.get("total_proofs"),
        "prover_wallets": state.get("prover_wallets"),
        "wrapper_wallets": state.get("wrapper_wallets"),
        "wallet_stats_count": len(wallet_stats),
    }


def _consumed_summary(consumed: Any, path: Path) -> dict[str, Any]:
    if isinstance(consumed, list):
        latest = consumed[-1] if consumed else None
        count = len(consumed)
    else:
        latest = None
        count = None
    return {
        "present": isinstance(consumed, list),
        "source_path": str(path) if path.exists() else None,
        "source_digest": _file_digest(path) if path.exists() else None,
        "consumed_count": count,
        "latest_consumed_proof_id": latest,
    }


def _count_lines(path: Path) -> int | None:
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return sum(1 for line in handle if line.strip())
    except OSError:
        return None


def _file_digest(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        return sha256_digest(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return None


def _any_pattern_in_file(path: Path, patterns: tuple[str, ...], *, max_bytes: int = 512_000) -> bool:
    if not path.is_file():
        return False
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            handle.seek(max(0, size - max_bytes))
            text = handle.read().decode("utf-8", errors="replace")
    except OSError:
        return False
    lowered = text.lower()
    return any(pattern.lower() in lowered for pattern in patterns)


def _tail_matching_lines(path: Path, patterns: tuple[str, ...], limit: int) -> list[str]:
    if not path.is_file():
        return []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    lowered_patterns = tuple(pattern.lower() for pattern in patterns)
    matches = [line for line in lines if any(pattern in line.lower() for pattern in lowered_patterns)]
    return matches[-limit:]


def _count_tx_hashes(path: Path, *, max_bytes: int) -> int:
    if not path.is_file():
        return 0
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            handle.seek(max(0, size - max_bytes))
            text = handle.read().decode("utf-8", errors="replace")
    except OSError:
        return 0
    return len(set(TX_HASH_RE.findall(text)))


def _git_summary(root: Path) -> dict[str, Any]:
    remote = _git_output(root, ("remote", "get-url", "origin"))
    head = _git_output(root, ("rev-parse", "--short", "HEAD"))
    branch = _git_output(root, ("branch", "--show-current"))
    status = _git_output(root, ("status", "--short"))
    return {
        "repository": _github_repo_from_remote(remote),
        "remote": remote,
        "branch": branch,
        "head": head,
        "dirty": bool(status),
        "source_checked": (
            "Local git metadata only; GitHub remote was verified during implementation "
            "but is not queried by the hosted API."
        ),
    }


def _git_output(root: Path, args: tuple[str, ...]) -> str | None:
    try:
        completed = subprocess.run(
            ("git", *args),
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout.strip() or None


def _github_repo_from_remote(remote: str | None) -> str | None:
    if not remote:
        return None
    ssh_match = re.search(r"github\.com[:/](?P<repo>[^/]+/[^/.]+)(?:\.git)?$", remote)
    if ssh_match:
        return ssh_match.group("repo")
    https_match = re.search(r"github\.com/(?P<repo>[^/]+/[^/.]+)(?:\.git)?$", remote)
    if https_match:
        return https_match.group("repo")
    return None


def _treasury_delta_reconciled(logs_dir: Path) -> bool:
    if _any_pattern_in_file(logs_dir / "harvest.log", ("swap executed", "treasury eth delta", "harvest tx")):
        return not _any_pattern_in_file(logs_dir / "harvest.log", ("Balance is 0",))
    return False


def _verification_summary(
    proof_valid: bool,
    proof_current: bool,
    attestor_receipts_observed: bool,
    treasury_delta_reconciled: bool,
) -> dict[str, Any]:
    return {
        "qflop_vdf_proof_observed": proof_valid,
        "qflop_vdf_proof_current": proof_current,
        "attestor_lifecycle_observed": attestor_receipts_observed,
        "positive_treasury_eth_delta_reconciled": treasury_delta_reconciled,
        "counts_as_revenue": treasury_delta_reconciled,
    }


def _summary(
    status: str,
    proof_valid: bool,
    proof_stale: bool,
    attestor_receipts_observed: bool,
    treasury_delta_reconciled: bool,
) -> str:
    if treasury_delta_reconciled:
        return "qflop-backfill has receipts-backed treasury ETH delta evidence."
    if proof_valid and proof_stale:
        return "qflop-backfill VDF proof exists, but it is stale and not revenue proof."
    if proof_valid and not attestor_receipts_observed:
        return "qflop-backfill VDF proof exists, but no onchain attestor lifecycle was observed."
    if status == "missing":
        return "qflop-backfill runtime evidence is unavailable."
    return "qflop-backfill proof import is available but not reconciled into treasury ETH."
