"""Shared feature schema for TypeTrace model training and inference.

The Isolation Forest is intentionally restricted to timing features that exist in
both the public liveness dataset and live TypeTrace sessions. TypeTrace-specific
writing-process features remain available to the behavioral rule layer, but they
are never passed into the Isolation Forest.
"""

from __future__ import annotations

from typing import Iterable, List

PUBLIC_TIMING_FEATURE_COLUMNS = [
    "ht_count",
    "ft_count",
    "total_keys_log",
    "alnum_ratio",
    "space_ratio",
    "special_key_ratio",
    "missing_ht_ratio",
    "missing_ft_ratio",
    "ht_mean",
    "ht_std",
    "ht_cv",
    "ht_median",
    "ht_iqr",
    "ht_p10",
    "ht_p25",
    "ht_p75",
    "ht_p90",
    "ht_min",
    "ht_max",
    "ht_entropy",
    "ht_skew",
    "ht_kurtosis",
    "ft_mean",
    "ft_std",
    "ft_cv",
    "ft_median",
    "ft_iqr",
    "ft_p10",
    "ft_p25",
    "ft_p75",
    "ft_p90",
    "ft_min",
    "ft_max",
    "ft_entropy",
    "ft_skew",
    "ft_kurtosis",
    "ft_autocorr",
    "ft_diff_mean",
    "ft_diff_std",
    "ft_low_variance_ratio",
    "pause_marker_ratio",
    "burst_ratio",
    "ht_ft_correlation",
]

TYPETRACE_LIVE_FEATURE_COLUMNS = [
    "log_wpm",
    "active_duration_log",
    "paste_count_log",
    "paste_ratio",
    "cut_count_log",
    "delete_actions_log",
    "deleted_characters_log",
    "deletion_ratio",
    "bulk_deletion_ratio",
    "revision_pressure",
    "pause_count_log",
    "idle_break_count_log",
]

# The trained Isolation Forest consumes only cross-domain timing features.
MODEL_FEATURE_COLUMNS = list(PUBLIC_TIMING_FEATURE_COLUMNS)

# Complete feature output retained for behavioral diagnostics and API responses.
ALL_FEATURE_COLUMNS = list(PUBLIC_TIMING_FEATURE_COLUMNS) + list(
    TYPETRACE_LIVE_FEATURE_COLUMNS
)

# Backward-compatible alias. Existing code that expects the complete extracted
# feature dictionary can continue importing FEATURE_COLUMNS.
FEATURE_COLUMNS = list(ALL_FEATURE_COLUMNS)

FEATURE_SCHEMA_VERSION = 2
MODEL_FEATURE_FAMILY = "public-timing-v2"
MODEL_NAME = "TypeTrace Isolation Forest"
MODEL_VERSION = "isolation-forest-v2-timing-only"
MINIMUM_KEYS_PER_SESSION = 20
MAX_VALID_TIMING_MS = 1500
MISSING_TIMING_MARKER = -1


def validate_model_feature_columns(columns: Iterable[str]) -> List[str]:
    """Validate and normalize an artifact's model feature order.

    Feature order is part of the trained-model contract. A reordered, missing,
    duplicated, or TypeTrace-live feature would make inference scientifically
    invalid even when the matrix shape happened to match.
    """

    normalized = [str(column).strip() for column in columns]

    if not normalized:
        raise ValueError("Model feature schema is empty.")

    if any(not column for column in normalized):
        raise ValueError("Model feature schema contains an empty column name.")

    if len(set(normalized)) != len(normalized):
        raise ValueError("Model feature schema contains duplicate column names.")

    if normalized != MODEL_FEATURE_COLUMNS:
        unexpected_live_features = sorted(
            set(normalized).intersection(TYPETRACE_LIVE_FEATURE_COLUMNS)
        )
        details = (
            f" TypeTrace-live columns found: {unexpected_live_features}."
            if unexpected_live_features
            else ""
        )
        raise ValueError(
            "Model feature schema is incompatible with the timing-only v2 "
            f"contract. Expected {MODEL_FEATURE_COLUMNS}, got {normalized}.{details}"
        )

    return normalized