"""Public liveness dataset loader for TypeTrace Isolation Forest training."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import pandas as pd

from app.ml.feature_extraction import extract_public_csv_features

log = logging.getLogger("TypeTrace-DatasetLoader")


@dataclass(frozen=True)
class DatasetFileIdentity:
    path: Path
    label: str
    group_id: str
    user_id: str
    source_dataset: str
    synth_profile: str
    synth_method: str


def classify_dataset_file(path: Path) -> DatasetFileIdentity:
    """
    Infer label/group metadata from filenames such as:

    GAY-A1F6NOYLVNUA9A-1-HUMAN.csv
    GAY-A1F6NOYLVNUA9A-1-BetweenSubject-AverageSynthesizer.csv

    The group_id deliberately ignores the synthesizer method so the human sample
    and all same-sequence synthetic counterparts stay in the same train/test
    split. This prevents leakage and fake accuracy.
    """
    parts = path.stem.split("-")
    source_dataset = parts[0] if len(parts) > 0 else "UNKNOWN"
    user_id = parts[1] if len(parts) > 1 else "UNKNOWN_USER"
    sequence_id = parts[2] if len(parts) > 2 else "UNKNOWN_SEQUENCE"
    upper_name = path.name.upper()

    label = "HUMAN" if "HUMAN" in upper_name else "SYNTHETIC"
    synth_profile = "HUMAN" if label == "HUMAN" else (parts[3] if len(parts) > 3 else "UNKNOWN_PROFILE")
    synth_method = "HUMAN" if label == "HUMAN" else (parts[4] if len(parts) > 4 else "UNKNOWN_SYNTH")
    group_id = f"{source_dataset}-{user_id}-{sequence_id}"

    return DatasetFileIdentity(
        path=path,
        label=label,
        group_id=group_id,
        user_id=user_id,
        source_dataset=source_dataset,
        synth_profile=synth_profile,
        synth_method=synth_method,
    )


def iter_dataset_csv_files(dataset_dir: Path) -> Iterable[Path]:
    yield from sorted(path for path in dataset_dir.rglob("*.csv") if path.is_file())


def load_liveness_dataset(dataset_dir: str | Path, *, max_files: Optional[int] = None) -> pd.DataFrame:
    dataset_path = Path(dataset_dir)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset directory does not exist: {dataset_path}")

    rows: List[Dict[str, object]] = []
    skipped = 0
    files = list(iter_dataset_csv_files(dataset_path))
    if max_files is not None:
        files = files[: max(0, int(max_files))]

    log.info("Found %s CSV files under %s", len(files), dataset_path)

    for index, csv_path in enumerate(files, start=1):
        identity = classify_dataset_file(csv_path)
        try:
            df = pd.read_csv(csv_path)
            features = extract_public_csv_features(df)
            if features is None:
                skipped += 1
                continue
            features.update(
                {
                    "label": identity.label,
                    "group_id": identity.group_id,
                    "user_id": identity.user_id,
                    "source_dataset": identity.source_dataset,
                    "synth_profile": identity.synth_profile,
                    "synth_method": identity.synth_method,
                    "file_name": csv_path.name,
                    "file_path": str(csv_path),
                }
            )
            rows.append(features)
        except Exception as exc:  # pragma: no cover - training-time resilience
            skipped += 1
            log.debug("Skipped %s: %s", csv_path, exc)

        if index % 1000 == 0:
            log.info("Processed %s/%s files", index, len(files))

    frame = pd.DataFrame(rows)
    if frame.empty:
        log.warning("No usable dataset rows were extracted. skipped=%s", skipped)
        return frame

    counts = frame["label"].value_counts().to_dict()
    log.info("Loaded dataset rows: %s | skipped=%s", counts, skipped)
    return frame
