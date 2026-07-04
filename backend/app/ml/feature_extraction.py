"""
Feature extraction for TypeTrace Isolation Forest liveness detection.

The public dataset stores one free-text keystroke sample per CSV with columns:
- VK: Microsoft virtual key code
- HT: hold/dwell time in ms
- FT: flight time in ms

The dataset marks pauses/timings above 1500 ms with -1. This module treats -1
as a missing/censored marker, not a real timing value.
"""

from __future__ import annotations

import math
from statistics import mean, median, pstdev
from typing import Any, Dict, Iterable, List, Optional, Sequence

import numpy as np
import pandas as pd

from app.ml.feature_schema import (
    FEATURE_COLUMNS,
    MAX_VALID_TIMING_MS,
    MINIMUM_KEYS_PER_SESSION,
    MISSING_TIMING_MARKER,
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
        if math.isnan(numeric) or numeric == MISSING_TIMING_MARKER or numeric > MAX_VALID_TIMING_MS:
            missing += 1
    return missing / max(len(values_list), 1)


def _entropy(values: Sequence[float], bins: int = 12) -> float:
    if not values:
        return 0.0
    lo = min(values)
    hi = max(values)
    if lo == hi:
        return 0.0
    hist, _ = np.histogram(np.asarray(values, dtype=float), bins=bins, range=(lo, hi))
    total = hist.sum()
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
    m = float(np.mean(arr))
    s = float(np.std(arr))
    series = pd.Series(arr)
    return {
        f"{prefix}_count": float(len(arr)),
        f"{prefix}_mean": m,
        f"{prefix}_std": s,
        f"{prefix}_cv": float(s / max(abs(m), 1e-9)),
        f"{prefix}_median": float(np.median(arr)),
        f"{prefix}_iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25)),
        f"{prefix}_p10": float(np.percentile(arr, 10)),
        f"{prefix}_p25": float(np.percentile(arr, 25)),
        f"{prefix}_p75": float(np.percentile(arr, 75)),
        f"{prefix}_p90": float(np.percentile(arr, 90)),
        f"{prefix}_min": float(np.min(arr)),
        f"{prefix}_max": float(np.max(arr)),
        f"{prefix}_entropy": _entropy(values),
        f"{prefix}_skew": float(series.skew()) if len(arr) >= 3 else 0.0,
        f"{prefix}_kurtosis": float(series.kurt()) if len(arr) >= 4 else 0.0,
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
    alnum = sum(1 for key in keys if 48 <= key <= 57 or 65 <= key <= 90)
    space = sum(1 for key in keys if key == 32)
    special = max(total - alnum - space, 0)
    return {
        "alnum_ratio": alnum / total,
        "space_ratio": space / total,
        "special_key_ratio": special / total,
    }


def extract_public_csv_features(df: pd.DataFrame) -> Optional[Dict[str, float]]:
    """Extract one feature vector from one public liveness CSV file."""
    required = {"VK", "HT", "FT"}
    if df is None or not required.issubset(set(df.columns)):
        return None
    if len(df) < MINIMUM_KEYS_PER_SESSION:
        return None

    ht_values = _clean_timing_series(df["HT"].tolist())
    ft_values = _clean_timing_series(df["FT"].tolist())

    if len(ft_values) < MINIMUM_KEYS_PER_SESSION // 2:
        return None

    features: Dict[str, float] = {}
    features.update(_vk_ratios(df["VK"].tolist()))
    features.update(_series_stats("ht", ht_values))
    features.update(_series_stats("ft", ft_values))

    features["total_keys_log"] = float(math.log1p(len(df)))
    features["missing_ht_ratio"] = _missing_ratio(df["HT"].tolist())
    features["missing_ft_ratio"] = _missing_ratio(df["FT"].tolist())
    features["pause_marker_ratio"] = features["missing_ft_ratio"]

    if len(ft_values) >= 3:
        ft_arr = np.asarray(ft_values, dtype=float)
        diff = np.diff(ft_arr)
        features["ft_diff_mean"] = float(np.mean(np.abs(diff))) if len(diff) else 0.0
        features["ft_diff_std"] = float(np.std(diff)) if len(diff) else 0.0
        if len(ft_arr) >= 4 and float(np.std(ft_arr)) > 1e-9:
            features["ft_autocorr"] = float(np.corrcoef(ft_arr[:-1], ft_arr[1:])[0, 1])
        else:
            features["ft_autocorr"] = 0.0
        features["ft_low_variance_ratio"] = float(np.mean(np.abs(diff) <= 5)) if len(diff) else 0.0
        features["burst_ratio"] = float(np.mean(ft_arr <= 25))
    else:
        features["ft_diff_mean"] = 0.0
        features["ft_diff_std"] = 0.0
        features["ft_autocorr"] = 0.0
        features["ft_low_variance_ratio"] = 0.0
        features["burst_ratio"] = 0.0

    if len(ht_values) >= 3 and len(ft_values) >= 3:
        n = min(len(ht_values), len(ft_values))
        ht_arr = np.asarray(ht_values[:n], dtype=float)
        ft_arr = np.asarray(ft_values[:n], dtype=float)
        if float(np.std(ht_arr)) > 1e-9 and float(np.std(ft_arr)) > 1e-9:
            features["ht_ft_correlation"] = float(np.corrcoef(ht_arr, ft_arr)[0, 1])
        else:
            features["ht_ft_correlation"] = 0.0
    else:
        features["ht_ft_correlation"] = 0.0

    for column in FEATURE_COLUMNS:
        features.setdefault(column, 0.0)
    return sanitize_feature_vector(features)


def _event_type(event: Dict[str, Any]) -> str:
    return str(event.get("type") or "").lower()


def _event_key(event: Dict[str, Any]) -> str:
    return str(event.get("key") or "")


def extract_typetrace_event_features(
    *,
    events: List[Dict[str, Any]],
    stats: Any = None,
    text_content: str = "",
) -> Dict[str, float]:
    """Extract production inference features from TypeTrace editor events."""
    keydown_events = [event for event in events if isinstance(event, dict) and _event_type(event) == "keydown"]
    flight_values = [
        _safe_float(event.get("flight_time"))
        for event in keydown_events
        if 0 < _safe_float(event.get("flight_time")) <= MAX_VALID_TIMING_MS
    ]
    dwell_values = [
        _safe_float(event.get("dwell_time"))
        for event in keydown_events
        if 0 < _safe_float(event.get("dwell_time")) <= MAX_VALID_TIMING_MS
    ]

    vk_proxy = []
    for event in keydown_events:
        key = _event_key(event)
        if len(key) == 1:
            vk_proxy.append(ord(key.upper()))
        elif key == " ":
            vk_proxy.append(32)
        else:
            vk_proxy.append(0)

    df = pd.DataFrame(
        {
            "VK": vk_proxy or [0] * max(len(flight_values), 1),
            "HT": dwell_values + [MISSING_TIMING_MARKER] * max(len(vk_proxy) - len(dwell_values), 0),
            "FT": flight_values + [MISSING_TIMING_MARKER] * max(len(vk_proxy) - len(flight_values), 0),
        }
    )
    public_features = extract_public_csv_features(df)
    if public_features is None:
        public_features = {column: 0.0 for column in FEATURE_COLUMNS}
        public_features.update(_series_stats("ht", dwell_values))
        public_features.update(_series_stats("ft", flight_values))
        public_features.update(_vk_ratios(vk_proxy))
        public_features["total_keys_log"] = float(math.log1p(len(keydown_events)))

    paste_events = [event for event in events if isinstance(event, dict) and (_event_type(event) == "paste" or _event_key(event) == "__PASTE_EVENT__")]
    cut_events = [event for event in events if isinstance(event, dict) and (_event_type(event) == "cut" or _event_key(event) == "__CUT_EVENT__")]
    idle_breaks = [event for event in events if isinstance(event, dict) and str(event.get("inputType") or "") == "historyIdleBreak"]

    deleted_chars = 0
    delete_actions = 0
    bulk_delete_actions = 0
    for event in events:
        if not isinstance(event, dict):
            continue
        key = _event_key(event)
        event_type = _event_type(event)
        explicit_deleted = _safe_int(event.get("chars_deleted", event.get("deletedCharacters", 0)))
        is_delete = key in {"Backspace", "Delete", "__TEXT_REVISION__"} or explicit_deleted > 0
        if event_type == "keyup":
            continue
        if is_delete:
            delete_actions += 1
            deleted = explicit_deleted or 1
            deleted_chars += deleted
            if deleted >= 2 or bool(event.get("isBulkDeletion") or event.get("bulk_deletion")):
                bulk_delete_actions += 1

    text_length = max(len(text_content or ""), 1)
    words = max(len((text_content or "").split()), 1)
    session_seconds = _safe_float(getattr(stats, "sessionSeconds", None), 0.0)
    wpm = _safe_float(getattr(stats, "wpm", None), 0.0)
    pauses = _safe_int(getattr(stats, "pauses", None), 0)

    public_features.update(
        {
            "log_wpm": float(math.log1p(max(wpm, 0.0))),
            "active_duration_log": float(math.log1p(max(session_seconds, 0.0))),
            "paste_count_log": float(math.log1p(len(paste_events))),
            "paste_ratio": min(1.0, len(paste_events) / max(words, 1)),
            "cut_count_log": float(math.log1p(len(cut_events))),
            "delete_actions_log": float(math.log1p(delete_actions)),
            "deleted_characters_log": float(math.log1p(deleted_chars)),
            "deletion_ratio": min(1.0, delete_actions / max(len(keydown_events), 1)),
            "bulk_deletion_ratio": min(1.0, bulk_delete_actions / max(delete_actions, 1)),
            "revision_pressure": min(1.0, deleted_chars / max(text_length, 1)),
            "pause_count_log": float(math.log1p(pauses)),
            "idle_break_count_log": float(math.log1p(len(idle_breaks))),
        }
    )
    return sanitize_feature_vector(public_features)


def sanitize_feature_vector(features: Dict[str, Any]) -> Dict[str, float]:
    clean: Dict[str, float] = {}
    for column in FEATURE_COLUMNS:
        value = _safe_float(features.get(column, 0.0), 0.0)
        # Keep feature values bounded enough to avoid exploding inference if a
        # browser bug or corrupted draft sends impossible telemetry.
        clean[column] = float(max(-10_000.0, min(10_000.0, value)))
    return clean


def feature_vector_to_matrix(features: Dict[str, Any]) -> np.ndarray:
    clean = sanitize_feature_vector(features)
    return np.asarray([[clean[column] for column in FEATURE_COLUMNS]], dtype=float)
