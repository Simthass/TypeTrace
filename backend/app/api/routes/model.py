from fastapi import APIRouter, Depends

from app.api.deps import require_teacher
from app.ml.inference_engine import inference_engine
from app.models.user import User


router = APIRouter()


@router.get("/model/status")
async def get_model_status():
    """
    Returns the current Isolation Forest model loading status, metrics, feature
    schema, and fallback availability.
    """

    return inference_engine.get_status()


@router.get("/model/metrics")
async def get_model_metrics():
    """
    Public-read model metrics for dissertation/demo transparency.

    No private student evidence is exposed here.
    """

    status = inference_engine.get_status()
    return {
        "status": status.get("status"),
        "model_available": status.get("model_available"),
        "model_name": status.get("model_name"),
        "model_version": status.get("model_version"),
        "trained_at": status.get("trained_at"),
        "metrics": status.get("metrics") or {},
        "decision_note": (
            "Isolation Forest scores are behavioral anomaly evidence, not calibrated "
            "probabilities and not automatic misconduct proof."
        ),
    }


@router.get("/model/features")
async def get_model_features():
    """
    Returns the active feature schema used by the inference engine.
    """

    status = inference_engine.get_status()
    return {
        "status": status.get("status"),
        "model_available": status.get("model_available"),
        "feature_count": status.get("feature_count"),
        "feature_columns": status.get("feature_columns") or [],
    }


@router.post("/model/reload")
async def reload_model(
    current_user: User = Depends(require_teacher),
):
    """
    Reloads ML artifacts from disk.

    Teacher-only because it is an operational action.
    """

    return inference_engine.reload()
