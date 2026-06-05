

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any

from app.db.database import get_db
from app.models.session import TypingSession
from app.models.user import User
from app.schemas.session import SessionReplayResponse, ReplaySessionMetadata, ReplayMetrics

# ✅ FIX 1: Correct import path — get_current_user lives in deps.py, NOT security.py
from app.api.deps import get_current_user

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: Calculate real metrics from raw keystroke event array
# Previously these were hardcoded constants. Now they are computed.
# ─────────────────────────────────────────────────────────────────────────────

def _compute_replay_metrics(
    raw_events: List[Dict[str, Any]],
    total_keystrokes: int,
    deletions: int,
    pauses: int,
    wpm: int,
    avg_iki: int,
) -> ReplayMetrics:
    """
    Derives all replay panel metrics from the raw keystroke event array.
    Every value here is calculated — nothing is hardcoded.

    Fields calculated:
      - avg_iki:          direct from DB column (already computed at capture time)
      - dwell_time:       mean of all non-null dwell_time values in the event array
      - deletion_ratio:   deletions / max(total_keystrokes, 1)
      - paste_count:      count of __PASTE_EVENT__ entries
      - longest_pause_ms: largest flight_time value across the event array
      - burst_count:      pauses column value (already calculated at capture time)
      - wpm:              direct from DB column
      - active_time_pct:  ratio of keys with flight_time < 2000ms (engaged typing)
                          vs total inter-key intervals recorded
    """
    paste_count = 0
    dwell_times: List[float] = []
    flight_times: List[float] = []
    engaged_intervals = 0
    total_intervals = 0

    for event in raw_events:
        if not isinstance(event, dict):
            continue

        # Count paste events
        if event.get("key") == "__PASTE_EVENT__":
            paste_count += 1
            continue

        # Collect dwell times (how long each key is held)
        dwell = event.get("dwell_time")
        if dwell is not None and isinstance(dwell, (int, float)) and 10 <= dwell <= 2000:
            dwell_times.append(float(dwell))

        # Collect flight times (inter-key intervals) for pause and active-time analysis
        flight = event.get("flight_time")
        if flight is not None and isinstance(flight, (int, float)) and flight > 0:
            flight_times.append(float(flight))
            total_intervals += 1
            # "Engaged typing" = flight time under 2 seconds (not a thinking pause)
            if flight < 2000:
                engaged_intervals += 1

    # ── Mean dwell time ───────────────────────────────────────────────────────
    mean_dwell_ms = int(sum(dwell_times) / len(dwell_times)) if dwell_times else 0

    # ── Longest pause ─────────────────────────────────────────────────────────
    # Only count pauses longer than 1 second as actual "pauses"
    actual_pauses = [f for f in flight_times if f > 1000]
    longest_pause_ms = int(max(actual_pauses)) if actual_pauses else 0

    # ── Deletion ratio ────────────────────────────────────────────────────────
    safe_total = max(total_keystrokes, 1)
    deletion_ratio = round(deletions / safe_total, 2)

    # ── Active time percentage ────────────────────────────────────────────────
    # Percentage of inter-key intervals that represent active typing vs pausing
    active_time_pct = (
        round((engaged_intervals / total_intervals) * 100)
        if total_intervals > 0
        else 0
    )

    return ReplayMetrics(
        avg_iki=avg_iki,
        dwell_time=mean_dwell_ms,          # ✅ FIX 2: Was hardcoded 120
        deletion_ratio=deletion_ratio,
        paste_count=paste_count,
        longest_pause_ms=longest_pause_ms,  # ✅ FIX 3: Was hardcoded 14500
        burst_count=pauses,
        wpm=wpm,
        active_time_pct=active_time_pct,    # ✅ FIX 4: Was hardcoded 85
    )


# ─────────────────────────────────────────────────────────────────────────────
# REPLAY ENDPOINT — ORM-based version (uses async SQLAlchemy)
# The primary replay path is in ml_service.py (raw SQL, sync engine).
# This ORM version is here for clean architectural separation and future use.
# Both paths now compute real metrics — no hardcoded values anywhere.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/replay", response_model=SessionReplayResponse)
async def get_session_replay(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns full keystroke event array + computed metrics for the replay engine.

    Security:
      - JWT authentication via get_current_user (from deps.py)
      - Ownership check: students can only replay their own sessions
    """
    # ── 1. Fetch session from DB ──────────────────────────────────────────────
    query = select(TypingSession).where(TypingSession.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )

    # ── 2. Ownership check ────────────────────────────────────────────────────
    if str(session.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You can only replay your own sessions.",
        )

    # ── 3. Parse raw keystroke events ─────────────────────────────────────────
    import json
    raw_events: List[Dict[str, Any]] = []
    if session.raw_keystroke_data is not None:
        try:
            raw_events = (
                json.loads(session.raw_keystroke_data)
                if isinstance(session.raw_keystroke_data, str)
                else session.raw_keystroke_data
            )
        except (json.JSONDecodeError, TypeError):
            raw_events = []

    # ── 4. Compute derived values ─────────────────────────────────────────────
    word_count = (
        len(session.text_content.split()) if session.text_content else 0
    )
    duration_ms = (session.duration_seconds or 0) * 1000
    total_keystrokes = session.total_keystrokes or 1
    deletions = session.deletions or 0

    # ── 5. Compute all metrics from real data (no hardcoded values) ───────────
    metrics = _compute_replay_metrics(
        raw_events=raw_events,
        total_keystrokes=total_keystrokes,
        deletions=deletions,
        pauses=session.pauses or 0,
        wpm=session.wpm or 0,
        avg_iki=session.avg_iki or 0,
    )

    # ── 6. Return full response ───────────────────────────────────────────────
    return SessionReplayResponse(
        session=ReplaySessionMetadata(
            title=session.title or "Untitled Document",
            classification=session.classification_result or "UNKNOWN",
            confidence=session.ml_confidence_score or 0.0,
            duration_ms=duration_ms,
            word_count=word_count,
            student_id=current_user.student_id or "",
        ),
        metrics=metrics,
        events=raw_events,
    )