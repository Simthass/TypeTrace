"""Train the TypeTrace timing-only Isolation Forest.

Usage:

    cd backend
    python -m app.ml.train_isolation_forest --dataset-dir "D:\\DATASET"

The model is trained only on HUMAN samples and only on timing features that are
available in both the public VK/HT/FT dataset and live TypeTrace telemetry.
TypeTrace-specific process features are evaluated separately by behavioral
rules and are deliberately excluded from this model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

from app.ml.dataset_loader import load_liveness_dataset
from app.ml.feature_schema import (
    FEATURE_SCHEMA_VERSION,
    MODEL_FEATURE_COLUMNS,
    MODEL_FEATURE_FAMILY,
    MODEL_NAME,
    MODEL_VERSION,
    TYPETRACE_LIVE_FEATURE_COLUMNS,
    validate_model_feature_columns,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("TypeTrace-IsolationForestTraining")

DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
PRIMARY_ARTIFACT_FILENAMES = (
    "isolation_forest.joblib",
    "scaler.joblib",
    "feature_schema.json",
    "metrics.json",
    "model_card.json",
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_metric(value: Any) -> float:
    try:
        result = float(value)
        if math.isnan(result) or math.isinf(result):
            return 0.0
        return round(result, 6)
    except (TypeError, ValueError):
        return 0.0


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _atomic_json_dump(payload: Dict[str, Any], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}.",
        suffix=".tmp",
        dir=destination.parent,
    )
    temporary_path = Path(temporary_name)

    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2, sort_keys=True)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary_path, destination)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def _atomic_joblib_dump(payload: Any, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}.",
        suffix=".tmp",
        dir=destination.parent,
    )
    os.close(descriptor)
    temporary_path = Path(temporary_name)

    try:
        joblib.dump(payload, temporary_path)
        os.replace(temporary_path, destination)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def _prepare_train_test(
    frame: pd.DataFrame,
    *,
    test_size: float,
    random_state: int,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    if not 0.05 <= test_size <= 0.5:
        raise ValueError("test_size must be between 0.05 and 0.5.")

    required_columns = {"label", "group_id"}
    missing_columns = sorted(required_columns.difference(frame.columns))
    if missing_columns:
        raise ValueError(
            f"Dataset frame is missing required columns: {missing_columns}."
        )

    groups = frame["group_id"].astype(str).to_numpy()
    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=test_size,
        random_state=random_state,
    )
    train_index, test_index = next(
        splitter.split(frame, frame["label"], groups)
    )

    train_frame = frame.iloc[train_index].copy()
    test_frame = frame.iloc[test_index].copy()

    train_groups = set(train_frame["group_id"].astype(str))
    test_groups = set(test_frame["group_id"].astype(str))
    overlap = train_groups.intersection(test_groups)
    if overlap:
        raise RuntimeError(
            "Grouped split leaked samples between train and test sets: "
            f"{sorted(overlap)[:5]}"
        )

    human_train = int((train_frame["label"] == "HUMAN").sum())
    human_test = int((test_frame["label"] == "HUMAN").sum())
    synthetic_test = int((test_frame["label"] == "SYNTHETIC").sum())

    if human_train < 20:
        raise ValueError(
            f"Not enough human training samples after split: {human_train}."
        )
    if human_test < 1 or synthetic_test < 1:
        raise ValueError(
            "Holdout split must contain at least one HUMAN and one SYNTHETIC "
            f"sample. Got HUMAN={human_test}, SYNTHETIC={synthetic_test}."
        )

    return train_frame, test_frame


def _evaluate_scores(
    *,
    y_true: np.ndarray,
    decision_scores: np.ndarray,
    threshold: float,
) -> Dict[str, Any]:
    """Evaluate one fixed threshold.

    Labels use 1=HUMAN and 0=SYNTHETIC. Higher Isolation Forest scores indicate
    greater similarity to the learned human timing baseline.
    """

    y_pred = (decision_scores >= threshold).astype(int)
    matrix = confusion_matrix(y_true, y_pred, labels=[1, 0])

    human_accepted = int(matrix[0][0])
    human_flagged = int(matrix[0][1])
    synthetic_accepted = int(matrix[1][0])
    synthetic_detected = int(matrix[1][1])

    human_total = max(human_accepted + human_flagged, 1)
    synthetic_total = max(synthetic_accepted + synthetic_detected, 1)

    try:
        roc_auc = roc_auc_score(y_true, decision_scores)
    except ValueError:
        roc_auc = 0.0

    return {
        "accuracy": _safe_metric(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": _safe_metric(
            balanced_accuracy_score(y_true, y_pred)
        ),
        "precision_human": _safe_metric(
            precision_score(y_true, y_pred, pos_label=1, zero_division=0)
        ),
        "recall_human": _safe_metric(
            recall_score(y_true, y_pred, pos_label=1, zero_division=0)
        ),
        "f1_human": _safe_metric(
            f1_score(y_true, y_pred, pos_label=1, zero_division=0)
        ),
        "precision_synthetic": _safe_metric(
            precision_score(y_true, y_pred, pos_label=0, zero_division=0)
        ),
        "recall_synthetic": _safe_metric(
            recall_score(y_true, y_pred, pos_label=0, zero_division=0)
        ),
        "f1_synthetic": _safe_metric(
            f1_score(y_true, y_pred, pos_label=0, zero_division=0)
        ),
        "macro_f1": _safe_metric(
            f1_score(y_true, y_pred, average="macro", zero_division=0)
        ),
        "roc_auc": _safe_metric(roc_auc),
        "false_positive_rate_human_flagged": _safe_metric(
            human_flagged / human_total
        ),
        "false_negative_rate_synthetic_accepted": _safe_metric(
            synthetic_accepted / synthetic_total
        ),
        "synthetic_detection_rate": _safe_metric(
            synthetic_detected / synthetic_total
        ),
        "confusion_matrix_labels": ["HUMAN", "SYNTHETIC"],
        "confusion_matrix": matrix.tolist(),
        "confusion_matrix_interpretation": {
            "human_accepted": human_accepted,
            "human_flagged": human_flagged,
            "synthetic_accepted": synthetic_accepted,
            "synthetic_detected": synthetic_detected,
        },
        "decision_threshold": _safe_metric(threshold),
    }


def _prepare_feature_frame(
    frame: pd.DataFrame,
    feature_columns: list[str],
) -> pd.DataFrame:
    missing_columns = [
        column for column in feature_columns if column not in frame.columns
    ]
    if missing_columns:
        raise ValueError(
            "Dataset feature extraction did not produce required model columns: "
            f"{missing_columns}."
        )

    return (
        frame[feature_columns]
        .astype(float)
        .replace([np.inf, -np.inf], 0.0)
        .fillna(0.0)
    )


def _write_artifact_manifest(artifact_path: Path) -> Dict[str, Any]:
    files: Dict[str, Dict[str, Any]] = {}

    for filename in PRIMARY_ARTIFACT_FILENAMES:
        file_path = artifact_path / filename
        if not file_path.exists():
            raise FileNotFoundError(
                f"Cannot create artifact manifest; missing {file_path}."
            )
        files[filename] = {
            "sha256": _sha256_file(file_path),
            "size_bytes": file_path.stat().st_size,
        }

    manifest = {
        "manifest_version": 1,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "feature_family": MODEL_FEATURE_FAMILY,
        "generated_at": _utc_now(),
        "files": files,
    }
    _atomic_json_dump(manifest, artifact_path / "artifact_manifest.json")
    return manifest


def train(
    dataset_dir: str | Path,
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
    *,
    test_size: float = 0.25,
    random_state: int = 42,
    max_files: int | None = None,
    contamination: str | float = "auto",
) -> Dict[str, Any]:
    artifact_path = Path(artifact_dir)
    artifact_path.mkdir(parents=True, exist_ok=True)

    feature_columns = validate_model_feature_columns(MODEL_FEATURE_COLUMNS)
    live_feature_overlap = sorted(
        set(feature_columns).intersection(TYPETRACE_LIVE_FEATURE_COLUMNS)
    )
    if live_feature_overlap:
        raise RuntimeError(
            "Timing-only model contract was violated by live features: "
            f"{live_feature_overlap}."
        )

    frame = load_liveness_dataset(dataset_dir, max_files=max_files)
    if frame.empty:
        raise RuntimeError("No usable dataset rows were loaded.")

    train_frame, test_frame = _prepare_train_test(
        frame,
        test_size=test_size,
        random_state=random_state,
    )
    human_train = train_frame[train_frame["label"] == "HUMAN"].copy()

    x_train = _prepare_feature_frame(human_train, feature_columns)
    x_test = _prepare_feature_frame(test_frame, feature_columns)
    y_test = (test_frame["label"] == "HUMAN").astype(int).to_numpy()

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_test_scaled = scaler.transform(x_test)

    model = IsolationForest(
        n_estimators=300,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
        bootstrap=False,
    )
    model.fit(x_train_scaled)

    train_scores = model.decision_function(x_train_scaled)
    test_scores = model.decision_function(x_test_scaled)

    threshold = float(np.percentile(train_scores, 5))
    metrics = _evaluate_scores(
        y_true=y_test,
        decision_scores=test_scores,
        threshold=threshold,
    )

    score_profile = {
        "train_score_min": _safe_metric(np.min(train_scores)),
        "train_score_p01": _safe_metric(np.percentile(train_scores, 1)),
        "train_score_p05": _safe_metric(np.percentile(train_scores, 5)),
        "train_score_p10": _safe_metric(np.percentile(train_scores, 10)),
        "train_score_p50": _safe_metric(np.percentile(train_scores, 50)),
        "train_score_p90": _safe_metric(np.percentile(train_scores, 90)),
        "train_score_p95": _safe_metric(np.percentile(train_scores, 95)),
        "train_score_max": _safe_metric(np.max(train_scores)),
        "test_score_min": _safe_metric(np.min(test_scores)),
        "test_score_max": _safe_metric(np.max(test_scores)),
    }
    metrics.update(score_profile)

    trained_at = _utc_now()
    training_summary = {
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "trained_at": trained_at,
        "dataset_dir": str(Path(dataset_dir)),
        "total_samples": int(len(frame)),
        "total_human_samples": int((frame["label"] == "HUMAN").sum()),
        "total_synthetic_samples": int(
            (frame["label"] == "SYNTHETIC").sum()
        ),
        "train_samples": int(len(train_frame)),
        "human_train_samples": int(len(human_train)),
        "test_samples": int(len(test_frame)),
        "human_test_samples": int(
            (test_frame["label"] == "HUMAN").sum()
        ),
        "synthetic_test_samples": int(
            (test_frame["label"] == "SYNTHETIC").sum()
        ),
        "train_group_count": int(train_frame["group_id"].nunique()),
        "test_group_count": int(test_frame["group_id"].nunique()),
        "group_split": True,
        "group_overlap_count": 0,
        "test_size": test_size,
        "random_state": random_state,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "feature_family": MODEL_FEATURE_FAMILY,
        "feature_count": len(feature_columns),
        "feature_columns": feature_columns,
        "excluded_live_feature_columns": TYPETRACE_LIVE_FEATURE_COLUMNS,
        "algorithm": "IsolationForest",
        "n_estimators": 300,
        "contamination": contamination,
        "threshold_policy": (
            "5th percentile of training HUMAN decision_function scores"
        ),
    }

    model_card = {
        **training_summary,
        "intended_use": (
            "Timing-liveness and anomaly evidence for TypeTrace academic "
            "writing sessions."
        ),
        "training_policy": (
            "Train only on human-written public keystroke samples using the "
            "cross-domain timing feature family; evaluate on a leakage-safe "
            "human and synthesized holdout."
        ),
        "architecture_note": (
            "WPM, active duration, paste, deletion, revision, pause-count, and "
            "idle-break features are intentionally excluded from Isolation "
            "Forest and remain in the separate behavioral rule layer."
        ),
        "decision_note": (
            "Isolation Forest outputs are anomaly scores, not calibrated "
            "probabilities, authorship proof, or automatic misconduct decisions."
        ),
        "limitations": [
            "Does not judge essay semantic originality.",
            "Does not establish the identity of the writer.",
            "Should support academic review, not automatically punish students.",
            "Public dataset timings above 1500 ms are censored and treated as missing.",
            "TypeTrace-collected sessions require separate external validation.",
        ],
        "metrics": metrics,
    }

    feature_schema = {
        "schema_version": FEATURE_SCHEMA_VERSION,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "feature_family": MODEL_FEATURE_FAMILY,
        "feature_columns": feature_columns,
        "feature_count": len(feature_columns),
        "excluded_live_feature_columns": TYPETRACE_LIVE_FEATURE_COLUMNS,
        "missing_value_policy": (
            "Missing or non-finite values are replaced with zero after feature "
            "engineering."
        ),
        "timing_policy": (
            "-1 and timings above 1500 ms are treated as missing or censored "
            "for the timing model."
        ),
        "feature_order_is_contractual": True,
    }

    metrics_payload = {**training_summary, **metrics}

    _atomic_joblib_dump(
        model,
        artifact_path / "isolation_forest.joblib",
    )
    _atomic_joblib_dump(
        scaler,
        artifact_path / "scaler.joblib",
    )
    _atomic_json_dump(
        feature_schema,
        artifact_path / "feature_schema.json",
    )
    _atomic_json_dump(metrics_payload, artifact_path / "metrics.json")
    _atomic_json_dump(model_card, artifact_path / "model_card.json")

    # Preserve filenames used by older local scripts while keeping the primary
    # artifact contract explicit and versioned.
    _atomic_joblib_dump(
        model,
        artifact_path / "typetrace_isolation_forest_model.joblib",
    )
    _atomic_joblib_dump(
        scaler,
        artifact_path / "typetrace_isolation_forest_scaler.joblib",
    )

    manifest = _write_artifact_manifest(artifact_path)

    log.info("Saved timing-only Isolation Forest artifacts to %s", artifact_path)
    log.info("Model features (%s): %s", len(feature_columns), feature_columns)
    log.info("Metrics: %s", json.dumps(metrics, indent=2))

    return {
        "training_summary": training_summary,
        "metrics": metrics,
        "artifact_manifest": manifest,
        "artifact_dir": str(artifact_path),
    }


def _parse_contamination(value: str) -> str | float:
    normalized = value.strip().lower()
    if normalized == "auto":
        return "auto"

    try:
        contamination = float(normalized)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "contamination must be 'auto' or a number between 0 and 0.5."
        ) from exc

    if not 0 < contamination <= 0.5:
        raise argparse.ArgumentTypeError(
            "numeric contamination must be greater than 0 and at most 0.5."
        )
    return contamination


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train the TypeTrace timing-only Isolation Forest"
    )
    parser.add_argument(
        "--dataset-dir",
        required=True,
        help=(
            "Root directory containing public VK/HT/FT CSV files, for example "
            "D:\\DATASET"
        ),
    )
    parser.add_argument(
        "--artifacts-dir",
        default=str(DEFAULT_ARTIFACT_DIR),
        help="Directory where versioned model artifacts are written.",
    )
    parser.add_argument("--test-size", type=float, default=0.25)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Optional file cap for local pipeline debugging only.",
    )
    parser.add_argument(
        "--contamination",
        type=_parse_contamination,
        default="auto",
        help="Isolation Forest contamination: 'auto' or a number in (0, 0.5].",
    )
    arguments = parser.parse_args()

    train(
        dataset_dir=arguments.dataset_dir,
        artifact_dir=arguments.artifacts_dir,
        test_size=arguments.test_size,
        random_state=arguments.random_state,
        max_files=arguments.max_files,
        contamination=arguments.contamination,
    )


if __name__ == "__main__":
    main()