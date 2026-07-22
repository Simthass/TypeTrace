from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_teacher
from app.core.config import settings
from app.ml.inference_engine import inference_engine
from app.models.user import User


router = APIRouter()


def _public_model_status() -> dict[str, object]:
    """Return operationally safe model metadata for public UI use."""

    model_status = inference_engine.get_status()
    return {
        "status": model_status.get("status"),
        "model_available": bool(model_status.get("model_available")),
        "model_name": model_status.get("model_name"),
        "model_version": model_status.get("model_version"),
        "feature_family": model_status.get("feature_family"),
        "feature_count": model_status.get("feature_count"),
        "decision_note": (
            "The score is behavioral evidence for review. It is not a "
            "calibrated probability or an automatic misconduct decision."
        ),
    }


@router.get("/model/status")
async def get_model_status():
    """Return only public, review-safe model status fields."""

    return _public_model_status()


@router.get("/model/metrics")
async def get_model_metrics():
    """Return aggregate evaluation metrics without local artifact details."""

    model_status = inference_engine.get_status()
    return {
        **_public_model_status(),
        "trained_at": model_status.get("trained_at"),
        "metrics": model_status.get("metrics") or {},
    }


@router.get("/model/features")
async def get_model_features():
    """Return the public timing-only feature schema."""

    model_status = inference_engine.get_status()
    return {
        "status": model_status.get("status"),
        "model_available": bool(model_status.get("model_available")),
        "feature_family": model_status.get("feature_family"),
        "feature_count": model_status.get("feature_count"),
        "feature_columns": model_status.get("feature_columns") or [],
    }


@router.post("/model/reload")
async def reload_model(
    current_user: User = Depends(require_teacher),
):
    """Reload model artifacts only when explicitly enabled outside production."""

    if settings.is_production or not settings.ALLOW_MODEL_RELOAD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Model reload is disabled in this environment.",
        )

    return inference_engine.reload()
