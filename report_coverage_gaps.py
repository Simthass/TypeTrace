#!/usr/bin/env python3
r"""Print the largest TypeTrace production coverage gaps.

Run from repository root after a comprehensive coverage pass:

    backend\venv\Scripts\python.exe report_coverage_gaps.py

Authoritative input files:
- backend/coverage-app.json
- frontend/coverage/coverage-summary.json
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_JSON = ROOT / "backend" / "coverage-app.json"
FRONTEND_SUMMARY = ROOT / "frontend" / "coverage" / "coverage-summary.json"


def pct(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def backend_rows() -> list[tuple[int, float, str]]:
    payload = json.loads(BACKEND_JSON.read_text(encoding="utf-8"))
    rows: list[tuple[int, float, str]] = []

    for name, details in payload.get("files", {}).items():
        summary = details.get("summary", {})
        statements = int(summary.get("num_statements", 0) or 0)
        covered = int(summary.get("covered_lines", 0) or 0)
        missing = max(statements - covered, 0)
        percent = pct(summary.get("percent_covered", 0))
        rows.append((missing, percent, name.replace("\\", "/")))

    return sorted(rows, key=lambda row: (-row[0], row[1], row[2]))


def frontend_rows() -> list[tuple[int, float, str]]:
    payload = json.loads(FRONTEND_SUMMARY.read_text(encoding="utf-8"))
    rows: list[tuple[int, float, str]] = []

    for name, details in payload.items():
        if name == "total":
            continue
        line_info = details.get("lines", {})
        total = int(line_info.get("total", 0) or 0)
        covered = int(line_info.get("covered", 0) or 0)
        missing = max(total - covered, 0)
        percent = pct(line_info.get("pct", 0))
        rows.append((missing, percent, name.replace("\\", "/")))

    return sorted(rows, key=lambda row: (-row[0], row[1], row[2]))


def main() -> int:
    if not BACKEND_JSON.is_file():
        raise SystemExit(f"Missing backend report: {BACKEND_JSON}")
    if not FRONTEND_SUMMARY.is_file():
        raise SystemExit(f"Missing frontend report: {FRONTEND_SUMMARY}")

    backend = json.loads(BACKEND_JSON.read_text(encoding="utf-8"))
    frontend = json.loads(FRONTEND_SUMMARY.read_text(encoding="utf-8"))

    backend_total = backend.get("totals", {})
    frontend_total = frontend.get("total", {})

    print("TypeTrace authoritative coverage summary")
    print("---------------------------------------")
    print(
        "Backend runtime app: "
        f"{backend_total.get('percent_covered_display', backend_total.get('percent_covered', 'unknown'))}%"
    )
    print(
        "Frontend whole source: "
        f"lines={frontend_total.get('lines', {}).get('pct', 'unknown')}% "
        f"statements={frontend_total.get('statements', {}).get('pct', 'unknown')}% "
        f"branches={frontend_total.get('branches', {}).get('pct', 'unknown')}% "
        f"functions={frontend_total.get('functions', {}).get('pct', 'unknown')}%"
    )

    print("\nBackend: largest uncovered runtime production files")
    print("---------------------------------------------------")
    for missing, percent, name in backend_rows()[:30]:
        print(f"{missing:5d} missing | {percent:6.2f}% | {name}")

    print("\nFrontend: largest uncovered production files")
    print("--------------------------------------------")
    for missing, percent, name in frontend_rows()[:40]:
        print(f"{missing:5d} missing | {percent:6.2f}% | {name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
