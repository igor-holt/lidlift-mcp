from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_launcher_dry_run_produces_artifacts(workspace):
    env = os.environ.copy()
    env["GENESIS_WORKSPACE_ROOT"] = str(workspace)

    result = subprocess.run(
        [
            "bash",
            str(REPO_ROOT / "bin" / "one-click-launch.sh"),
            "--mode",
            "eth-agent-2026",
            "--capsule",
            "config/soul_capsule.json",
            "--proof-gate",
            "on",
            "--dry-run",
        ],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert (workspace / "inputs" / "evidence.json").exists()
    assert (workspace / "artifacts" / "proofs" / "latest.json").exists()
    assert (workspace / "artifacts" / "reports" / "latest.json").exists()

    with (workspace / "artifacts" / "reports" / "latest.json").open("r", encoding="utf-8") as handle:
        report = json.load(handle)

    assert report["closing_report"]["matched"] is True
    assert report["proof"]["verified"] is True
