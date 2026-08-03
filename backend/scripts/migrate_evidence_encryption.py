"""Controlled, all-or-nothing migration of historical private evidence.

Safety properties:
- Dry-run by default.
- Apply mode requires an explicit database-backup confirmation.
- Unknown-key Fernet tokens and malformed evidence block the entire migration.
- Existing active-cipher values are never re-encrypted.
- Plaintext and the known legacy development cipher are migrated to the active key.
- Reports contain identifiers and classifications only, never sensitive values.

Stop the API and background workers before applying this migration.

Dry run:
    python -m scripts.migrate_evidence_encryption --report migration-plan.json

Apply after taking and verifying a database backup:
    python -m scripts.migrate_evidence_encryption \
        --apply --confirm-database-backup --report migration-result.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from sqlalchemy import select

from app.core.crypto import encrypt_json, encrypt_text
from app.db.database import AsyncSessionLocal
from app.models.draft import DraftSession
from app.models.session import TypingSession
from scripts.evidence_encryption_maintenance import (
    BLOCKING_STATUSES,
    MIGRATABLE_STATUSES,
    ClassifiedEvidence,
    classify_json,
    classify_text,
)

FieldKind = Literal["text", "json"]


@dataclass
class MigrationPlanItem:
    entity_type: str
    entity_id: str
    entity: Any
    field: str
    kind: FieldKind
    source_status: str
    plaintext: Any


@dataclass(frozen=True)
class Blocker:
    entity_type: str
    entity_id: str
    field: str
    status: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the migration. Without this flag the command is read-only.",
    )
    parser.add_argument(
        "--confirm-database-backup",
        action="store_true",
        help="Required with --apply. Confirms a verified backup exists.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("evidence-encryption-migration.json"),
        help="Privacy-safe JSON report path.",
    )
    return parser.parse_args()


def _classify(kind: FieldKind, value: Any) -> ClassifiedEvidence:
    return classify_text(value) if kind == "text" else classify_json(value)


def _inspect(
    *,
    entity_type: str,
    entity_id: str,
    entity: Any,
    field: str,
    kind: FieldKind,
    status_counts: Counter[str],
    plans: list[MigrationPlanItem],
    blockers: list[Blocker],
) -> None:
    result = _classify(kind, getattr(entity, field))
    status_counts[result.status] += 1

    if result.status in MIGRATABLE_STATUSES:
        plans.append(
            MigrationPlanItem(
                entity_type=entity_type,
                entity_id=entity_id,
                entity=entity,
                field=field,
                kind=kind,
                source_status=result.status,
                plaintext=result.plaintext,
            )
        )
    elif result.status in BLOCKING_STATUSES:
        blockers.append(
            Blocker(
                entity_type=entity_type,
                entity_id=entity_id,
                field=field,
                status=result.status,
            )
        )


def _report_payload(
    *,
    apply: bool,
    sessions_checked: int,
    drafts_checked: int,
    status_counts: Counter[str],
    plans: list[MigrationPlanItem],
    blockers: list[Blocker],
    committed: bool,
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if apply else "dry_run",
        "sessions_checked": sessions_checked,
        "drafts_checked": drafts_checked,
        "fields_checked": sum(status_counts.values()),
        "status_counts": dict(sorted(status_counts.items())),
        "planned_update_count": len(plans),
        "committed_update_count": len(plans) if committed else 0,
        "blocker_count": len(blockers),
        "committed": committed,
        "sensitive_values_included": False,
        "planned_updates": [
            {
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "field": item.field,
                "source_status": item.source_status,
            }
            for item in plans
        ],
        "blockers": [
            {
                "entity_type": blocker.entity_type,
                "entity_id": blocker.entity_id,
                "field": blocker.field,
                "status": blocker.status,
            }
            for blocker in blockers
        ],
    }


def _write_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


async def run(*, apply: bool, confirmed_backup: bool, report_path: Path) -> int:
    if apply and not confirmed_backup:
        print(
            "Refusing to mutate evidence without --confirm-database-backup. "
            "Take and verify a database backup first."
        )
        return 4

    status_counts: Counter[str] = Counter()
    plans: list[MigrationPlanItem] = []
    blockers: list[Blocker] = []
    sessions_checked = 0
    drafts_checked = 0
    committed = False

    async with AsyncSessionLocal() as db:
        try:
            session_query = select(TypingSession).order_by(TypingSession.id.asc())
            draft_query = select(DraftSession).order_by(DraftSession.id.asc())
            if apply:
                session_query = session_query.with_for_update()
                draft_query = draft_query.with_for_update()

            sessions = list((await db.execute(session_query)).scalars().all())
            drafts = list((await db.execute(draft_query)).scalars().all())

            for session in sessions:
                sessions_checked += 1
                _inspect(
                    entity_type="typing_session",
                    entity_id=str(session.id),
                    entity=session,
                    field="text_content",
                    kind="text",
                    status_counts=status_counts,
                    plans=plans,
                    blockers=blockers,
                )
                _inspect(
                    entity_type="typing_session",
                    entity_id=str(session.id),
                    entity=session,
                    field="raw_keystroke_data",
                    kind="json",
                    status_counts=status_counts,
                    plans=plans,
                    blockers=blockers,
                )

            for draft in drafts:
                drafts_checked += 1
                _inspect(
                    entity_type="draft_session",
                    entity_id=str(draft.id),
                    entity=draft,
                    field="text_content",
                    kind="text",
                    status_counts=status_counts,
                    plans=plans,
                    blockers=blockers,
                )
                _inspect(
                    entity_type="draft_session",
                    entity_id=str(draft.id),
                    entity=draft,
                    field="keystroke_array",
                    kind="json",
                    status_counts=status_counts,
                    plans=plans,
                    blockers=blockers,
                )

            if blockers:
                await db.rollback()
                payload = _report_payload(
                    apply=apply,
                    sessions_checked=sessions_checked,
                    drafts_checked=drafts_checked,
                    status_counts=status_counts,
                    plans=plans,
                    blockers=blockers,
                    committed=False,
                )
                _write_report(report_path, payload)
                print(
                    f"Migration blocked by {len(blockers)} field(s). No database "
                    f"changes were committed. Report: {report_path}"
                )
                return 2

            if not apply:
                await db.rollback()
                payload = _report_payload(
                    apply=False,
                    sessions_checked=sessions_checked,
                    drafts_checked=drafts_checked,
                    status_counts=status_counts,
                    plans=plans,
                    blockers=blockers,
                    committed=False,
                )
                _write_report(report_path, payload)
                print(
                    f"Dry run complete: {len(plans)} field(s) can be migrated; "
                    f"0 blockers. Report: {report_path}"
                )
                return 0

            for item in plans:
                encrypted = (
                    encrypt_text(item.plaintext)
                    if item.kind == "text"
                    else encrypt_json(item.plaintext)
                )
                setattr(item.entity, item.field, encrypted)

            await db.flush()

            verification_failures: list[Blocker] = []
            for item in plans:
                verified = _classify(item.kind, getattr(item.entity, item.field))
                if verified.status != "ACTIVE_CIPHER":
                    verification_failures.append(
                        Blocker(
                            entity_type=item.entity_type,
                            entity_id=item.entity_id,
                            field=item.field,
                            status=verified.status,
                        )
                    )

            if verification_failures:
                blockers.extend(verification_failures)
                await db.rollback()
                payload = _report_payload(
                    apply=True,
                    sessions_checked=sessions_checked,
                    drafts_checked=drafts_checked,
                    status_counts=status_counts,
                    plans=plans,
                    blockers=blockers,
                    committed=False,
                )
                _write_report(report_path, payload)
                print(
                    "Post-write verification failed. The transaction was rolled "
                    f"back. Report: {report_path}"
                )
                return 3

            await db.commit()
            committed = True
        except Exception:
            await db.rollback()
            raise

    payload = _report_payload(
        apply=apply,
        sessions_checked=sessions_checked,
        drafts_checked=drafts_checked,
        status_counts=status_counts,
        plans=plans,
        blockers=blockers,
        committed=committed,
    )
    _write_report(report_path, payload)
    print(
        f"Migration committed atomically: {len(plans)} field(s) now use the "
        f"active cipher. Report: {report_path}"
    )
    return 0


def main() -> int:
    args = parse_args()
    return asyncio.run(
        run(
            apply=bool(args.apply),
            confirmed_backup=bool(args.confirm_database_backup),
            report_path=args.report,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
