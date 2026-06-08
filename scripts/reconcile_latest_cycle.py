from __future__ import annotations

import json
import sys

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.common.paths import reports_dir


def main() -> int:
    latest = reports_dir() / "latest.json"
    if not latest.exists():
        print("No latest cycle report found.", file=sys.stderr)
        return 1

    with latest.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    reconciliation = payload.get("closing_report") or {}
    if not reconciliation.get("matched"):
        print("Latest cycle report is missing a matched reconciliation.", file=sys.stderr)
        return 1
    print(json.dumps(reconciliation, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
