from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.common.paths import workspace_root
from services.executor.policy_checks import startup_security_summary

LITERAL_SECRET_PATTERNS = [
    re.compile(r"(API_KEY|SECRET|PRIVATE_KEY|password|token)\s*[:=]\s*[\"'][^\"']+[\"']", re.IGNORECASE),
    re.compile(r"\b0x[a-fA-F0-9]{64}\b"),
    re.compile(r"-----BEGIN [A-Z ]+PRIVATE KEY-----"),
]

IGNORE_SEGMENTS = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".npm-cache",
    "dist/assets",
    ".vite",
    ".vite-temp",
}


def iter_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if any(segment in relative for segment in IGNORE_SEGMENTS):
            continue
        files.append(path)
    return files


def main() -> int:
    root = workspace_root()
    issues = list(startup_security_summary())
    for path in iter_files(root):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for pattern in LITERAL_SECRET_PATTERNS:
            if pattern.search(text):
                issues.append(f"{path.relative_to(root)} matches secret-literal pattern {pattern.pattern}")
                break

    if issues:
        for issue in issues:
            print(issue, file=sys.stderr)
        return 1
    print("secret scan passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
