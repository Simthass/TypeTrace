"""Privacy-safe audit of stored TypeTrace evidence encryption.

The generated report includes identifiers, field names, classifications, and
aggregate counts only. It never contains essay text, raw events, ciphertext,
keys, or decrypted values.

Run from the backend directory:
    python -m scripts.audit_evidence_encryption --report evidence-audit.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.draft import DraftSession
from app.models.session import TypingSession
from scripts.evidence_encryption_maintenance import (
    PASSING_STATUSES,
    ClassifiedEvidence,
    classify_json,
    classify_text,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("evidence-encryption-audit.json"),
        help="Privacy-safe JSON report path.",
    )
    return parser.parse_args()


def _finding(
    *,
    entity_type: str,
    entity_id: str,
    field: str,
    result: ClassifiedEvidence,
) -> dict[str, str]:
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "field": field,
        "status": result.status,
    }


def _inspect_field(
    *,
    entity_type: str,
    entity_id: str,
    field: str,
    value: Any,
    classifier: Callable[[Any], ClassifiedEvidence],
    status_counts: Counter[str],
    non_active: list[dict[str, str]],
) -> None:
    result = classifier(value)
    status_counts[result.status] += 1
    if result.status not in PASSING_STATUSES:
        non_active.append(
            _finding(
                entity_type=entity_type,
                entity_id=entity_id,
                field=field,
                result=result,
            )
        )


async def run(*, report_path: Path) -> int:
    status_counts: Counter[str] = Counter()
    non_active: list[dict[str, str]] = []
    sessions_checked = 0
    drafts_checked = 0

    async with AsyncSessionLocal() as db:
        session_result = await db.execute(
            select(
                TypingSession.id,
                TypingSession.text_content,
                TypingSession.raw_keystroke_data,
            ).order_by(TypingSession.id.asc())
        )
        for row in session_result.all():
            sessions_checked += 1
            _inspect_field(
                entity_type="typing_session",
                entity_id=str(row.id),
                field="text_content",
                value=row.text_content,
                classifier=classify_text,
                status_counts=status_counts,
                non_active=non_active,
            )
            _inspect_field(
                entity_type="typing_session",
                entity_id=str(row.id),
                field="raw_keystroke_data",
                value=row.raw_keystroke_data,
                classifier=classify_json,
                status_counts=status_counts,
                non_active=non_active,
            )

        draft_result = await db.execute(
            select(
                DraftSession.id,
                DraftSession.text_content,
                DraftSession.keystroke_array,
            ).order_by(DraftSession.id.asc())
        )
        for row in draft_result.all():
            drafts_checked += 1
            _inspect_field(
                entity_type="draft_session",
                entity_id=str(row.id),
                field="text_content",
                value=row.text_content,
                classifier=classify_text,
                status_counts=status_counts,
                non_active=non_active,
            )
            _inspect_field(
                entity_type="draft_session",
                entity_id=str(row.id),
                field="keystroke_array",
                value=row.keystroke_array,
                classifier=classify_json,
                status_counts=status_counts,
                non_active=non_active,
            )
        await db.rollback()

    non_empty_checked = sum(
        count for status, count in status_counts.items() if status != "EMPTY"
    )
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sessions_checked": sessions_checked,
        "drafts_checked": drafts_checked,
        "fields_checked": sum(status_counts.values()),
        "non_empty_fields_checked": non_empty_checked,
        "status_counts": dict(sorted(status_counts.items())),
        "non_active_count": len(non_active),
        "all_non_empty_evidence_uses_active_cipher": not non_active,
        "sensitive_values_included": False,
        "non_active_fields": non_active,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if non_active:
        print(
            f"Encryption audit found {len(non_active)} non-active fields. "
            f"Classification report: {report_path}"
        )
        print(
            "Run the controlled migration in dry-run mode. Do not enable legacy "
            "application reads as a workaround."
        )
        return 2

    print(
        f"Encryption audit passed: {sessions_checked} sessions and "
        f"{drafts_checked} drafts use the active cipher for every non-empty "
        "private evidence field."
    )
    return 0


def main() -> int:
    args = parse_args()
    return asyncio.run(run(report_path=args.report))


if __name__ == "__main__":
    raise SystemExit(main())
