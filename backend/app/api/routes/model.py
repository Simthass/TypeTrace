# backend/app/api/routes/model.py

from fastapi import APIRouter, Depends

from app.api.deps import require_teacher
from app.ml.inference_engine import inference_engine
from app.models.user import User


router = APIRouter()


@router.get("/model/status")
async def get_model_status():
    """
    Returns the current ML artifact loading status.

    Useful for demo, debugging, and dissertation evidence.
    """

    return inference_engine.get_status()


@router.post("/model/reload")
async def reload_model(
    current_user: User = Depends(require_teacher),
):
    """
    Reloads ML artifacts from disk.

    Teacher-only because it is an operational action.
    """

    return inference_engine.reload()