# backend/app/api/routes/sessions.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_db, get_current_user # using my jwt token verifier
from app.models.user import User
from app.models.session import TypingSession
from app.schemas.session import SessionAnalyzeRequest, SessionResponse
import json

router = APIRouter()

@router.post("/analyze", response_model=SessionResponse)
async def analyze_and_save_session(
    payload: SessionAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # prof gonna kill me if this crashes, adding basic validation
    if not payload.keystroke_array or len(payload.keystroke_array) < 10:
        raise HTTPException(status_code=400, detail="Not enough keystroke data to analyze bro")

    # TODO for next week: send payload.keystroke_array to the Python ML Random Forest model
    # for now im just gonna hardcode a fake score so i can test if the postgres db works
    
    # fake logic: if they paste a lot, flag as AI
    fake_score = 95.5
    fake_result = "HUMAN"
    
    if payload.stats.wpm > 120 or payload.stats.pauses == 0:
        fake_score = 12.4
        fake_result = "AI-GENERATED"

    # map the pydantic schema to the sqlalchemy database model
    new_session = TypingSession(
        user_id=current_user.id,
        title=payload.title,
        text_content=payload.text_content,
        wpm=payload.stats.wpm,
        total_keystrokes=payload.stats.keystrokes,
        deletions=payload.stats.deletions,
        pauses=payload.stats.pauses,
        avg_iki=payload.stats.avgIki,
        duration_seconds=payload.stats.sessionSeconds,
        ml_confidence_score=fake_score,
        classification_result=fake_result,
        # need to dump it to dict so postgres jsonb doesnt freak out
        raw_keystroke_data=[k.model_dump() for k in payload.keystroke_array] 
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    # sending back just the id and score so frontend can redirect to the results page
    return new_session