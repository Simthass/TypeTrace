"""Backward-compatible training entrypoint.

Older TypeTrace code imported FEATURE_COLUMNS, MINIMUM_KEYS_PER_SESSION, and
extract_features_from_keystroke_array from this module. Part 3 moves the real
Isolation Forest pipeline into dedicated modules while preserving those imports.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd

from app.ml.feature_extraction import (
    extract_public_csv_features as extract_features_from_dataframe,
    extract_typetrace_event_features,
)
from app.ml.feature_schema import FEATURE_COLUMNS, MINIMUM_KEYS_PER_SESSION
from app.ml.train_isolation_forest import main, train


def extract_features_from_keystroke_array(
    raw_array: List[Dict[str, Any]],
    total_keystrokes: Optional[int] = None,
    deletions: Optional[int] = None,
    pauses: Optional[int] = None,
    duration_seconds: Optional[float] = None,
    text_length: Optional[int] = None,
) -> Dict[str, float]:
    class _Stats:
        def __init__(self) -> None:
            self.keystrokes = total_keystrokes or 0
            self.deletions = deletions or 0
            self.pauses = pauses or 0
            self.sessionSeconds = duration_seconds or 0
            self.wpm = 0

    text_content = "x" * int(text_length or 0)
    return extract_typetrace_event_features(events=raw_array or [], stats=_Stats(), text_content=text_content)


if __name__ == "__main__":
    main()
