# backend/app/api/routes/sessions.py

from fastapi import APIRouter

router = APIRouter()

"""
Sessions router intentionally kept minimal.

Replay and audit endpoints are implemented in:
    backend/app/api/routes/replay.py

That router already exposes:
    GET /api/v1/replay/{session_id}
    GET /api/v1/sessions/{session_id}/replay

Keeping replay logic in one place avoids duplicate route handlers,
inconsistent authorization, and conflicting response formats.
"""