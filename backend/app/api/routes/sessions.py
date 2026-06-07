# backend/app/api/routes/sessions.py

from fastapi import APIRouter

router = APIRouter()

"""
Sessions router intentionally kept minimal.

Replay and audit endpoints are implemented in:
    backend/app/api/routes/replay.py

That router exposes:
    GET /api/v1/replay/{session_id}
    GET /api/v1/sessions/{session_id}/replay

Student session listing is implemented in:
    backend/app/api/routes/student.py

Teacher submission/session review is implemented in:
    backend/app/api/routes/teacher.py

Keeping this router minimal avoids duplicate replay handlers,
conflicting authorization rules, and inconsistent response formats.
"""