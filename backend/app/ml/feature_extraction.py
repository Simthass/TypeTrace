"""Feature extraction for TypeTrace timing-liveness inference.

The public dataset stores one free-text keystroke sample per CSV with columns:
- VK: Microsoft virtual key code
- HT: hold/dwell time in milliseconds
- FT: flight time in milliseconds

The public dataset marks censored or unavailable timings with ``-1``. Timings
above 1500 ms are excluded from the timing-liveness model so long thinking
pauses do not distort the cross-domain rhythm feature distribution. Long pauses
remain available to the separate TypeTrace behavioral analysis layer.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Sequence

import numpy as np
import pandas as pd

from app.ml.feature_schema import (
    ALL_FEATURE_COLUMNS,
    MAX_VALID_TIMING_MS,
    MINIMUM_KEYS_PER_SESSION,
    MISSING_TIMING_MARKER,
    MODEL_FEATURE_COLUMNS,
    TYPETRACE_LIVE_FEATURE_COLUMNS,
)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        if math.isnan(result) or math.isinf(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        result = int(round(float(value)))
        return max(0, result)
    except (TypeError, ValueError):
        return default


def _clean_timing_series(values: Iterable[Any]) -> List[float]:
    cleaned: List[float] = []
    for value in values:
        numeric = _safe_float(value, default=float("nan"))
        if math.isnan(numeric):
            continue
        if numeric == MISSING_TIMING_MARKER:
            continue
        if 0 <= numeric <= MAX_VALID_TIMING_MS:
            cleaned.append(float(numeric))
    return cleaned


def _missing_ratio(values: Iterable[Any]) -> float:
    values_list = list(values)
    if not values_list:
        return 0.0

    missing = 0
    for value in values_list:
        numeric = _safe_float(value, default=float("nan"))
        if (
            math.isnan(numeric)
            or numeric == MISSING_TIMING_MARKER
            or numeric < 0
            or numeric > MAX_VALID_TIMING_MS
        ):
            missing += 1

    return missing / max(len(values_list), 1)


def _entropy(values: Sequence[float], bins: int = 12) -> float:
    if not values:
        return 0.0

    lo = min(values)
    hi = max(values)
    if lo == hi:
        return 0.0

    hist, _ = np.histogram(
        np.asarray(values, dtype=float),
        bins=bins,
        range=(lo, hi),
    )
    total = int(hist.sum())
    if total <= 0:
        return 0.0

    probabilities = hist.astype(float) / float(total)
    probabilities = probabilities[probabilities > 0]
    return float(-np.sum(probabilities * np.log2(probabilities)))


def _series_stats(prefix: str, values: Sequence[float]) -> Dict[str, float]:
    if not values:
        return {
            f"{prefix}_count": 0.0,
            f"{prefix}_mean": 0.0,
            f"{prefix}_std": 0.0,
            f"{prefix}_cv": 0.0,
            f"{prefix}_median": 0.0,
            f"{prefix}_iqr": 0.0,
            f"{prefix}_p10": 0.0,
            f"{prefix}_p25": 0.0,
            f"{prefix}_p75": 0.0,
            f"{prefix}_p90": 0.0,
            f"{prefix}_min": 0.0,
            f"{prefix}_max": 0.0,
            f"{prefix}_entropy": 0.0,
            f"{prefix}_skew": 0.0,
            f"{prefix}_kurtosis": 0.0,
        }

    arr = np.asarray(values, dtype=float)
    average = float(np.mean(arr))
    standard_deviation = float(np.std(arr))
    series = pd.Series(arr)

    return {
        f"{prefix}_count": float(len(arr)),
        f"{prefix}_mean": average,
        f"{prefix}_std": standard_deviation,
        f"{prefix}_cv": float(
            standard_deviation / max(abs(average), 1e-9)
        ),
        f"{prefix}_median": float(np.median(arr)),
        f"{prefix}_iqr": float(
            np.percentile(arr, 75) - np.percentile(arr, 25)
        ),
        f"{prefix}_p10": float(np.percentile(arr, 10)),
        f"{prefix}_p25": float(np.percentile(arr, 25)),
        f"{prefix}_p75": float(np.percentile(arr, 75)),
        f"{prefix}_p90": float(np.percentile(arr, 90)),
        f"{prefix}_min": float(np.min(arr)),
        f"{prefix}_max": float(np.max(arr)),
        f"{prefix}_entropy": _entropy(values),
        f"{prefix}_skew": float(series.skew()) if len(arr) >= 3 else 0.0,
        f"{prefix}_kurtosis": (
            float(series.kurtosis()) if len(arr) >= 4 else 0.0
        ),
    }


def _vk_ratios(values: Iterable[Any]) -> Dict[str, float]:
    keys = [_safe_int(value) for value in values]
    total = len(keys)
    if total <= 0:
        return {
            "alnum_ratio": 0.0,
            "space_ratio": 0.0,
            "special_key_ratio": 0.0,
        }

    alphanumeric = sum(
        1 for key in keys if 48 <= key <= 57 or 65 <= key <= 90
    )
    spaces = sum(1 for key in keys if key == 32)
    special = max(total - alphanumeric - spaces, 0)

    return {
        "alnum_ratio": alphanumeric / total,
        "space_ratio": spaces / total,
        "special_key_ratio": special / total,
    }


def _add_flight_sequence_features(
    features: Dict[str, float],
    flight_values: Sequence[float],
) -> None:
    if len(flight_values) < 3:
        features.update(
            {
                "ft_diff_mean": 0.0,
                "ft_diff_std": 0.0,
                "ft_autocorr": 0.0,
                "ft_low_variance_ratio": 0.0,
                "burst_ratio": 0.0,
            }
        )
        return

    flight_array = np.asarray(flight_values, dtype=float)
    differences = np.diff(flight_array)
    absolute_differences = np.abs(differences)

    features["ft_diff_mean"] = (
        float(np.mean(absolute_differences))
        if len(absolute_differences)
        else 0.0
    )
    features["ft_diff_std"] = (
        float(np.std(differences)) if len(differences) else 0.0
    )

    if len(flight_array) >= 4 and float(np.std(flight_array)) > 1e-9:
        autocorrelation = float(
            np.corrcoef(flight_array[:-1], flight_array[1:])[0, 1]
        )
        features["ft_autocorr"] = (
            autocorrelation if math.isfinite(autocorrelation) else 0.0
        )
    else:
        features["ft_autocorr"] = 0.0

    features["ft_low_variance_ratio"] = (
        float(np.mean(absolute_differences <= 5))
        if len(absolute_differences)
        else 0.0
    )
    features["burst_ratio"] = float(np.mean(flight_array <= 25))


def _add_hold_flight_correlation(
    features: Dict[str, float],
    hold_values: Sequence[float],
    flight_values: Sequence[float],
) -> None:
    if len(hold_values) < 3 or len(flight_values) < 3:
        features["ht_ft_correlation"] = 0.0
        return

    sample_count = min(len(hold_values), len(flight_values))
    hold_array = np.asarray(hold_values[:sample_count], dtype=float)
    flight_array = np.asarray(flight_values[:sample_count], dtype=float)

    if (
        float(np.std(hold_array)) <= 1e-9
        or float(np.std(flight_array)) <= 1e-9
    ):
        features["ht_ft_correlation"] = 0.0
        return

    correlation = float(np.corrcoef(hold_array, flight_array)[0, 1])
    features["ht_ft_correlation"] = (
        correlation if math.isfinite(correlation) else 0.0
    )


def extract_public_csv_features(
    dataframe: pd.DataFrame,
) -> Optional[Dict[str, float]]:
    """Extract one complete feature dictionary from one public CSV sample."""

    required_columns = {"VK", "HT", "FT"}
    if dataframe is None or not required_columns.issubset(dataframe.columns):
        return None

    if len(dataframe) < MINIMUM_KEYS_PER_SESSION:
        return None

    hold_values = _clean_timing_series(dataframe["HT"].tolist())
    flight_values = _clean_timing_series(dataframe["FT"].tolist())

    if len(flight_values) < MINIMUM_KEYS_PER_SESSION // 2:
        return None

    features: Dict[str, float] = {}
    features.update(_vk_ratios(dataframe["VK"].tolist()))
    features.update(_series_stats("ht", hold_values))
    features.update(_series_stats("ft", flight_values))

    features["total_keys_log"] = float(math.log1p(len(dataframe)))
    features["missing_ht_ratio"] = _missing_ratio(
        dataframe["HT"].tolist()
    )
    features["missing_ft_ratio"] = _missing_ratio(
        dataframe["FT"].tolist()
    )
    features["pause_marker_ratio"] = features["missing_ft_ratio"]

    _add_flight_sequence_features(features, flight_values)
    _add_hold_flight_correlation(features, hold_values, flight_values)

    # Public samples do not contain TypeTrace writing-process fields. They are
    # retained as zero only in the complete diagnostic dictionary and are not
    # passed into the Isolation Forest.
    for column in TYPETRACE_LIVE_FEATURE_COLUMNS:
        features.setdefault(column, 0.0)

    return sanitize_feature_vector(features, ALL_FEATURE_COLUMNS)


def _event_type(event: Dict[str, Any]) -> str:
    return str(event.get("type") or "").strip().lower()


def _event_key(event: Dict[str, Any]) -> str:
    return str(event.get("key") or "")


def _event_vk_code(event: Dict[str, Any]) -> int:
    browser_code = _safe_int(event.get("keyCode"), 0)
    if 0 < browser_code <= 255:
        return browser_code

    key = _event_key(event)
    if len(key) == 1:
        upper = key.upper()
        return ord(upper) if len(upper) == 1 else 0

    return 0


def _event_timing_or_missing(event: Dict[str, Any], field: str) -> float:
    value = _safe_float(event.get(field), default=float("nan"))
    if math.isnan(value) or value <= 0 or value > MAX_VALID_TIMING_MS:
        return float(MISSING_TIMING_MARKER)
    return float(value)


def extract_typetrace_event_features(
    *,
    events: List[Dict[str, Any]],
    stats: Any = None,
    text_content: str = "",
) -> Dict[str, float]:
    """Extract timing and TypeTrace process features from editor telemetry.

    VK, HT, and FT values are kept row-aligned per keydown event. This avoids
    pairing one key's virtual-key code with a different key's timing when some
    browser events do not contain dwell or flight measurements.
    """

    clean_events = [event for event in events if isinstance(event, dict)]
    keydown_events = [
        event for event in clean_events if _event_type(event) == "keydown"
    ]

    timing_frame = pd.DataFrame(
        {
            "VK": [_event_vk_code(event) for event in keydown_events],
            "HT": [
                _event_timing_or_missing(event, "dwell_time")
                for event in keydown_events
            ],
            "FT": [
                _event_timing_or_missing(event, "flight_time")
                for event in keydown_events
            ],
        }
    )

    public_features = extract_public_csv_features(timing_frame)
    if public_features is None:
        hold_values = _clean_timing_series(timing_frame.get("HT", []))
        flight_values = _clean_timing_series(timing_frame.get("FT", []))
        virtual_keys = timing_frame.get("VK", [])

        public_features = {
            column: 0.0 for column in ALL_FEATURE_COLUMNS
        }
        public_features.update(_vk_ratios(virtual_keys))
        public_features.update(_series_stats("ht", hold_values))
        public_features.update(_series_stats("ft", flight_values))
        public_features["total_keys_log"] = float(
            math.log1p(len(keydown_events))
        )
        public_features["missing_ht_ratio"] = _missing_ratio(
            timing_frame.get("HT", [])
        )
        public_features["missing_ft_ratio"] = _missing_ratio(
            timing_frame.get("FT", [])
        )
        public_features["pause_marker_ratio"] = public_features[
            "missing_ft_ratio"
        ]
        _add_flight_sequence_features(public_features, flight_values)
        _add_hold_flight_correlation(
            public_features,
            hold_values,
            flight_values,
        )

    paste_events = [
        event
        for event in clean_events
        if _event_type(event) == "paste"
        or _event_key(event) == "__PASTE_EVENT__"
    ]
    cut_events = [
        event
        for event in clean_events
        if _event_type(event) == "cut"
        or _event_key(event) == "__CUT_EVENT__"
    ]
    idle_breaks = [
        event
        for event in clean_events
        if str(event.get("inputType") or "") == "historyIdleBreak"
    ]

    deleted_characters = 0
    delete_actions = 0
    bulk_delete_actions = 0

    for event in clean_events:
        if _event_type(event) == "keyup":
            continue

        key = _event_key(event)
        explicit_deleted = _safe_int(
            event.get(
                "chars_deleted",
                event.get("deletedCharacters", 0),
            )
        )
        is_delete = (
            key in {"Backspace", "Delete", "__TEXT_REVISION__"}
            or explicit_deleted > 0
        )
        if not is_delete:
            continue

        delete_actions += 1
        deleted = explicit_deleted or 1
        deleted_characters += deleted
        if deleted >= 2 or bool(
            event.get("isBulkDeletion")
            or event.get("bulk_deletion")
        ):
            bulk_delete_actions += 1

    text_length = max(len(text_content or ""), 1)
    word_count = max(len((text_content or "").split()), 1)
    session_seconds = _safe_float(
        getattr(stats, "sessionSeconds", None),
        0.0,
    )
    words_per_minute = _safe_float(getattr(stats, "wpm", None), 0.0)
    pause_count = _safe_int(getattr(stats, "pauses", None), 0)

    public_features.update(
        {
            "log_wpm": float(math.log1p(max(words_per_minute, 0.0))),
            "active_duration_log": float(
                math.log1p(max(session_seconds, 0.0))
            ),
            "paste_count_log": float(math.log1p(len(paste_events))),
            "paste_ratio": min(
                1.0,
                len(paste_events) / max(word_count, 1),
            ),
            "cut_count_log": float(math.log1p(len(cut_events))),
            "delete_actions_log": float(math.log1p(delete_actions)),
            "deleted_characters_log": float(
                math.log1p(deleted_characters)
            ),
            "deletion_ratio": min(
                1.0,
                delete_actions / max(len(keydown_events), 1),
            ),
            "bulk_deletion_ratio": min(
                1.0,
                bulk_delete_actions / max(delete_actions, 1),
            ),
            "revision_pressure": min(
                1.0,
                deleted_characters / max(text_length, 1),
            ),
            "pause_count_log": float(math.log1p(pause_count)),
            "idle_break_count_log": float(math.log1p(len(idle_breaks))),
        }
    )

    return sanitize_feature_vector(public_features, ALL_FEATURE_COLUMNS)


def sanitize_feature_vector(
    features: Dict[str, Any],
    feature_columns: Sequence[str] = ALL_FEATURE_COLUMNS,
) -> Dict[str, float]:
    """Return a finite, ordered feature dictionary for the requested schema."""

    clean: Dict[str, float] = {}
    for column in feature_columns:
        value = _safe_float(features.get(column, 0.0), 0.0)
        clean[str(column)] = float(
            max(-10_000.0, min(10_000.0, value))
        )
    return clean


def select_feature_vector(
    features: Dict[str, Any],
    feature_columns: Sequence[str] = MODEL_FEATURE_COLUMNS,
) -> Dict[str, float]:
    """Select the exact ordered subset consumed by a trained artifact."""

    return sanitize_feature_vector(features, feature_columns)


def feature_vector_to_matrix(
    features: Dict[str, Any],
    feature_columns: Sequence[str] = MODEL_FEATURE_COLUMNS,
) -> np.ndarray:
    """Build a single-row inference matrix using an explicit feature order."""

    columns = [str(column) for column in feature_columns]
    if not columns:
        raise ValueError("Cannot build a model matrix with an empty schema.")
    if len(set(columns)) != len(columns):
        raise ValueError("Cannot build a model matrix with duplicate columns.")

    clean = select_feature_vector(features, columns)
    return np.asarray(
        [[clean[column] for column in columns]],
        dtype=float,
    )