"""Train the TypeTrace Isolation Forest liveness model.

Usage on your machine:

    cd backend
    python -m app.ml.train_isolation_forest --dataset-dir "D:\\DATASET"

The model trains on HUMAN samples only and evaluates on a leakage-safe holdout
containing both HUMAN and SYNTHETIC samples. Group splitting keeps each human
sample and its same-sequence synthetic counterparts together.
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

from app.ml.dataset_loader import load_liveness_dataset
from app.ml.feature_schema import FEATURE_COLUMNS, MODEL_NAME, MODEL_VERSION

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("TypeTrace-IsolationForestTraining")

DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_metric(value: Any) -> float:
    try:
        result = float(value)
        if np.isnan(result) or np.isinf(result):
            return 0.0
        return round(result, 6)
    except Exception:
        return 0.0


def _prepare_train_test(frame: pd.DataFrame, *, test_size: float, random_state: int) -> Tuple[pd.DataFrame, pd.DataFrame]:
    groups = frame["group_id"].astype(str).to_numpy()
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_index, test_index = next(splitter.split(frame, frame["label"], groups))
    train_frame = frame.iloc[train_index].copy()
    test_frame = frame.iloc[test_index].copy()

    human_train = int((train_frame["label"] == "HUMAN").sum())
    human_test = int((test_frame["label"] == "HUMAN").sum())
    synthetic_test = int((test_frame["label"] == "SYNTHETIC").sum())
    if human_train < 20:
        raise ValueError(f"Not enough human training samples after split: {human_train}")
    if human_test < 1 or synthetic_test < 1:
        raise ValueError(
            "Holdout split must contain at least one HUMAN and one SYNTHETIC sample. "
            f"Got HUMAN={human_test}, SYNTHETIC={synthetic_test}."
        )
    return train_frame, test_frame


def _evaluate_scores(
    *,
    y_true: np.ndarray,
    decision_scores: np.ndarray,
    threshold: float,
) -> Dict[str, Any]:
    # y_true: 1=human, 0=synthetic/anomaly. Higher score is more normal.
    y_pred = (decision_scores >= threshold).astype(int)
    cm = confusion_matrix(y_true, y_pred, labels=[1, 0])
    tn_synth = int(cm[1][1]) if cm.shape == (2, 2) else 0
    fp_synth_as_human = int(cm[1][0]) if cm.shape == (2, 2) else 0
    tp_human = int(cm[0][0]) if cm.shape == (2, 2) else 0
    fn_human_as_anomaly = int(cm[0][1]) if cm.shape == (2, 2) else 0

    false_positive_rate = fn_human_as_anomaly / max(tp_human + fn_human_as_anomaly, 1)
    false_negative_rate = fp_synth_as_human / max(tn_synth + fp_synth_as_human, 1)

    try:
        roc_auc = roc_auc_score(y_true, decision_scores)
    except ValueError:
        roc_auc = 0.0

    return {
        "accuracy": _safe_metric(accuracy_score(y_true, y_pred)),
        "precision_human": _safe_metric(precision_score(y_true, y_pred, zero_division=0)),
        "recall_human": _safe_metric(recall_score(y_true, y_pred, zero_division=0)),
        "f1_human": _safe_metric(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": _safe_metric(roc_auc),
        "false_positive_rate_human_flagged": _safe_metric(false_positive_rate),
        "false_negative_rate_synthetic_accepted": _safe_metric(false_negative_rate),
        "confusion_matrix_labels": ["HUMAN", "SYNTHETIC"],
        "confusion_matrix": cm.tolist(),
        "decision_threshold": _safe_metric(threshold),
    }


def train(dataset_dir: str | Path, artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR, *, test_size: float = 0.25, random_state: int = 42, max_files: int | None = None, contamination: str | float = "auto") -> Dict[str, Any]:
    artifact_path = Path(artifact_dir)
    artifact_path.mkdir(parents=True, exist_ok=True)

    frame = load_liveness_dataset(dataset_dir, max_files=max_files)
    if frame.empty:
        raise RuntimeError("No usable dataset rows were loaded.")

    for column in FEATURE_COLUMNS:
        if column not in frame.columns:
            frame[column] = 0.0

    train_frame, test_frame = _prepare_train_test(frame, test_size=test_size, random_state=random_state)
    human_train = train_frame[train_frame["label"] == "HUMAN"].copy()

    X_train = human_train[FEATURE_COLUMNS].astype(float).replace([np.inf, -np.inf], 0).fillna(0)
    X_test = test_frame[FEATURE_COLUMNS].astype(float).replace([np.inf, -np.inf], 0).fillna(0)
    y_test = (test_frame["label"] == "HUMAN").astype(int).to_numpy()

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = IsolationForest(
        n_estimators=300,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
        bootstrap=False,
    )
    model.fit(X_train_scaled)

    train_scores = model.decision_function(X_train_scaled)
    test_scores = model.decision_function(X_test_scaled)

    threshold = float(np.percentile(train_scores, 5))
    metrics = _evaluate_scores(y_true=y_test, decision_scores=test_scores, threshold=threshold)

    score_profile = {
        "train_score_min": _safe_metric(np.min(train_scores)),
        "train_score_p01": _safe_metric(np.percentile(train_scores, 1)),
        "train_score_p05": _safe_metric(np.percentile(train_scores, 5)),
        "train_score_p10": _safe_metric(np.percentile(train_scores, 10)),
        "train_score_p50": _safe_metric(np.percentile(train_scores, 50)),
        "train_score_p90": _safe_metric(np.percentile(train_scores, 90)),
        "train_score_p95": _safe_metric(np.percentile(train_scores, 95)),
        "train_score_max": _safe_metric(np.max(train_scores)),
    }
    metrics.update(score_profile)

    training_summary = {
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "trained_at": _utc_now(),
        "dataset_dir": str(dataset_dir),
        "total_samples": int(len(frame)),
        "total_human_samples": int((frame["label"] == "HUMAN").sum()),
        "total_synthetic_samples": int((frame["label"] == "SYNTHETIC").sum()),
        "train_samples": int(len(train_frame)),
        "human_train_samples": int(len(human_train)),
        "test_samples": int(len(test_frame)),
        "human_test_samples": int((test_frame["label"] == "HUMAN").sum()),
        "synthetic_test_samples": int((test_frame["label"] == "SYNTHETIC").sum()),
        "group_split": True,
        "test_size": test_size,
        "random_state": random_state,
        "feature_count": len(FEATURE_COLUMNS),
        "feature_columns": FEATURE_COLUMNS,
        "algorithm": "IsolationForest",
        "contamination": contamination,
        "threshold_policy": "5th percentile of training HUMAN decision_function scores",
    }

    model_card = {
        **training_summary,
        "intended_use": "Behavioral liveness/anomaly evidence for academic writing sessions.",
        "training_policy": "Train only on human-written public keystroke samples; evaluate on leakage-safe human and synthesized holdout samples.",
        "decision_note": "Isolation Forest scores are anomaly scores, not proof of misconduct and not calibrated probabilities.",
        "limitations": [
            "Does not judge essay semantic originality.",
            "Should support academic review, not automatically punish students.",
            "Public dataset timings above 1500 ms are censored as -1 and treated as missing.",
            "TypeTrace-collected sessions should be used as external validation after collection is complete.",
        ],
        "metrics": metrics,
    }

    feature_schema = {
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "feature_columns": FEATURE_COLUMNS,
        "missing_value_policy": "Missing/non-finite values are replaced with zero after feature engineering.",
        "timing_policy": "-1 and timings over 1500 ms in the public dataset are treated as missing/censored.",
    }

    joblib.dump(model, artifact_path / "isolation_forest.joblib")
    joblib.dump(scaler, artifact_path / "scaler.joblib")
    (artifact_path / "feature_schema.json").write_text(json.dumps(feature_schema, indent=2), encoding="utf-8")
    (artifact_path / "metrics.json").write_text(json.dumps({**training_summary, **metrics}, indent=2), encoding="utf-8")
    (artifact_path / "model_card.json").write_text(json.dumps(model_card, indent=2), encoding="utf-8")

    # Backward-compatible filenames for older code/debugging scripts.
    joblib.dump(model, artifact_path / "typetrace_isolation_forest_model.joblib")
    joblib.dump(scaler, artifact_path / "typetrace_isolation_forest_scaler.joblib")

    log.info("Saved Isolation Forest artifacts to %s", artifact_path)
    log.info("Metrics: %s", json.dumps(metrics, indent=2))
    return {"training_summary": training_summary, "metrics": metrics, "artifact_dir": str(artifact_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train TypeTrace Isolation Forest liveness model")
    parser.add_argument("--dataset-dir", required=True, help="Root directory containing public VK/HT/FT CSV files, e.g. D:\\DATASET")
    parser.add_argument("--artifacts-dir", default=str(DEFAULT_ARTIFACT_DIR), help="Directory where model artifacts are written")
    parser.add_argument("--test-size", type=float, default=0.25)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--max-files", type=int, default=None, help="Optional debug cap for quick local runs")
    args = parser.parse_args()

    train(
        dataset_dir=args.dataset_dir,
        artifact_dir=args.artifacts_dir,
        test_size=args.test_size,
        random_state=args.random_state,
        max_files=args.max_files,
    )


if __name__ == "__main__":
    main()
