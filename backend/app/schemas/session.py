# backend/app/schemas/session.py
from pydantic import BaseModel
from typing import List, Optional
from typing import Dict, Any

# this gotta match EXACTLY what my React frontend sends or pydantic throws a 422 unprocessable entity error 

class KeystrokeEventSchema(BaseModel):
    key: str
    keyCode: int
    type: str
    timestamp: int
    down_time: int
    up_time: Optional[int] = None
    dwell_time: Optional[int] = None
    flight_time: Optional[int] = None
    documentLength: int
    pastedText: Optional[str] = None   # ← THE ONLY NEW FIELD


class SessionStatsSchema(BaseModel):
    wpm: int
    keystrokes: int
    deletions: int
    pauses: int
    avgIki: int
    sessionSeconds: int

class SessionAnalyzeRequest(BaseModel):
    title: str
    text_content: str
    keystroke_array: List[KeystrokeEventSchema]
    stats: SessionStatsSchema

class SessionResponse(BaseModel):
    id: int
    title: str
    ml_confidence_score: float
    classification_result: str
    # im not sending the 5000 keystrokes back to the frontend cos it will freeze the dashboard
    
    class Config:
        from_attributes = True
        

class ReplaySessionMetadata(BaseModel):
    title: str
    classification: str
    confidence: float
    duration_ms: int
    word_count: int
    student_id: str

class ReplayMetrics(BaseModel):
    avg_iki: int
    dwell_time: int
    deletion_ratio: float
    paste_count: int
    longest_pause_ms: int
    burst_count: int
    wpm: int
    active_time_pct: int

class SessionReplayResponse(BaseModel):
    session: ReplaySessionMetadata
    metrics: ReplayMetrics
    events: List[Dict[str, Any]] # Sending the raw JSONB array back