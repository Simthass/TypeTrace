"""Audit and optionally correct historical TypeTrace session word counts.

This script decrypts text through the application's configured crypto layer. It
never writes essay text to the report or logs.

Examples (run from the backend directory):
    python -m scripts.audit_word_counts --report word-count-audit.json
    python -m scripts.audit_word_counts --apply --report word-count-audit.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.core.crypto import decrypt_text
from app.db.database import AsyncSessionLocal
from app.models.session import TypingSession
from app.services.canonical_evidence import count_words


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist corrected values. Default is a read-only audit.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("word-count-audit.json"),
        help="Privacy-safe JSON report path.",
    )
    return parser.parse_args()


async def run(*, apply: bool, report_path: Path) -> int:
    checked = 0
    corrected = 0
    failures: list[dict[str, Any]] = []
    mismatches: list[dict[str, Any]] = []

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TypingSession).order_by(TypingSession.id.asc())
        )
        sessions = list(result.scalars().all())

        for session in sessions:
            checked += 1
            try:
                plain_text = decrypt_text(session.text_content) or ""
                calculated = count_words(plain_text)
            except Exception as exc:
                failures.append(
                    {
                        "session_id": int(session.id),
                        "error_type": type(exc).__name__,
                    }
                )
                continue

            stored = int(session.word_count or 0)
            if stored == calculated:
                continue

            mismatches.append(
                {
                    "session_id": int(session.id),
                    "stored_word_count": stored,
                    "calculated_word_count": calculated,
                }
            )
            if apply:
                session.word_count = calculated
                db.add(session)
                corrected += 1

        if apply and failures:
            await db.rollback()
            corrected = 0
        elif apply:
            await db.commit()
        else:
            await db.rollback()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if apply else "dry-run",
        "checked_sessions": checked,
        "mismatch_count": len(mismatches),
        "corrected_count": corrected,
        "failure_count": len(failures),
        "mismatches": mismatches,
        "failures": failures,
        "essay_text_included": False,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if failures:
        print(
            f"Audit failed safely for {len(failures)} sessions; no corrections were committed."
        )
        return 2
    print(
        f"Checked {checked} sessions; found {len(mismatches)} mismatches; "
        f"committed {corrected} corrections."
    )
    return 0


def main() -> int:
    args = parse_args()
    return asyncio.run(run(apply=args.apply, report_path=args.report))


if __name__ == "__main__":
    raise SystemExit(main())
