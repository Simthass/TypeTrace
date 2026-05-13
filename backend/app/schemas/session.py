# backend/app/schemas/session.py
from pydantic import BaseModel
from typing import List, Optional

# this gotta match EXACTLY what my React frontend sends or pydantic throws a 422 unprocessable entity error 

class KeystrokeEventSchema(BaseModel):
    key: str
    keyCode: int
    type: str
    timestamp: int
    down_time: int
    # using Optional cos up_time might be null if they just hold the key down forever lol
    up_time: Optional[int] = None
    dwell_time: Optional[int] = None
    flight_time: Optional[int] = None
    documentLength: int

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