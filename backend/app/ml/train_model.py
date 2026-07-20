"""Backward-compatible TypeTrace model-training entry point.

The production model is the timing-only Isolation Forest implemented in
``app.ml.train_isolation_forest``. Older local scripts may continue importing
``FEATURE_COLUMNS``, ``MINIMUM_KEYS_PER_SESSION``, feature extractors, ``train``,
and ``main`` from this module.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from app.ml.dataset_loader import load_liveness_dataset
from app.ml.feature_extraction import (
    extract_public_csv_features as extract_features_from_dataframe,
    extract_typetrace_event_features,
    select_feature_vector,
)
from app.ml.feature_schema import (
    MINIMUM_KEYS_PER_SESSION,
    MODEL_FEATURE_COLUMNS,
)
from app.ml.train_isolation_forest import main, train

# Backward-compatible training alias. Older scripts importing FEATURE_COLUMNS
# from this module now receive the exact timing-only columns consumed by the
# v2 model rather than the complete diagnostic feature dictionary.
FEATURE_COLUMNS = list(MODEL_FEATURE_COLUMNS)


def load_gonzalez_dataset(
    data_dir: str | Path,
    *,
    max_files: int | None = None,
) -> pd.DataFrame:
    """Compatibility wrapper around the current public dataset loader."""

    return load_liveness_dataset(data_dir, max_files=max_files)


def extract_features_from_keystroke_array(
    raw_array: List[Dict[str, Any]],
    total_keystrokes: Optional[int] = None,
    deletions: Optional[int] = None,
    pauses: Optional[int] = None,
    duration_seconds: Optional[float] = None,
    text_length: Optional[int] = None,
) -> Dict[str, float]:
    """Return the complete TypeTrace feature dictionary for one event stream."""

    class _Stats:
        def __init__(self) -> None:
            self.keystrokes = total_keystrokes or 0
            self.deletions = deletions or 0
            self.pauses = pauses or 0
            self.sessionSeconds = duration_seconds or 0
            self.wpm = 0

    text_content = "x" * int(text_length or 0)
    return extract_typetrace_event_features(
        events=raw_array or [],
        stats=_Stats(),
        text_content=text_content,
    )


def extract_model_features_from_keystroke_array(
    raw_array: List[Dict[str, Any]],
    total_keystrokes: Optional[int] = None,
    deletions: Optional[int] = None,
    pauses: Optional[int] = None,
    duration_seconds: Optional[float] = None,
    text_length: Optional[int] = None,
) -> Dict[str, float]:
    """Return only the ordered timing features consumed by the v2 model."""

    complete_features = extract_features_from_keystroke_array(
        raw_array=raw_array,
        total_keystrokes=total_keystrokes,
        deletions=deletions,
        pauses=pauses,
        duration_seconds=duration_seconds,
        text_length=text_length,
    )
    return select_feature_vector(complete_features, MODEL_FEATURE_COLUMNS)


if __name__ == "__main__":
    main()