from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db
from app.models.session import TypingSession
from app.models.user import User
from app.schemas.session import SessionReplayResponse, ReplaySessionMetadata, ReplayMetrics
from app.core.security import get_current_user # Assuming you have this auth dependency

router = APIRouter()

# ─── REPLAY ENGINE ENDPOINT ───────────────────────────────────────────────────

@router.get("/{session_id}/replay", response_model=SessionReplayResponse)
async def get_session_replay(
    session_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch the session
    query = select(TypingSession).where(TypingSession.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found in PostgreSQL")

    # 2. PRIVACY RULE: Validate ownership
    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access denied. You can only replay your own sessions."
        )

    # 3. Calculate metrics safely
    raw_events = session.raw_keystroke_data or []
    word_count = len(session.text_content.split()) if session.text_content else 0
    duration_ms = (session.duration_seconds or 0) * 1000

    deletions = session.deletions or 0
    total_keys = session.total_keystrokes or 1 # Prevent division by zero
    
    # 4. Return data matching the React Replay Engine schema
    return SessionReplayResponse(
        session=ReplaySessionMetadata(
            title=session.title or "Untitled Document",
            classification=session.classification_result or "UNKNOWN",
            confidence=session.ml_confidence_score or 0.0,
            duration_ms=duration_ms,
            word_count=word_count,
            student_id=current_user.student_id
        ),
        metrics=ReplayMetrics(
            avg_iki=session.avg_iki or 0,
            dwell_time=120, 
            deletion_ratio=round(deletions / total_keys, 2),
            paste_count=len([e for e in raw_events if e.get("type") == "paste"]),
            longest_pause_ms=14500, 
            burst_count=session.pauses or 0,
            wpm=session.wpm or 0,
            active_time_pct=85
        ),
        events=raw_events
    )