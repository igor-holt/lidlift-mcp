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
        print("{}")
        return 0
    with latest.open("r", encoding="utf-8") as handle:
        print(json.dumps(json.load(handle), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
