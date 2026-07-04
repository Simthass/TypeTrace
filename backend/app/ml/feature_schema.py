"""
TypeTrace ML feature schema.

This module is intentionally small and dependency-light because it is imported by
both the offline training pipeline and the production inference engine.

The schema is split into two groups:
- Public-dataset timing features extracted from VK/HT/FT CSV files.
- TypeTrace live-session features extracted from editor events/canonical stats.

Missing live-session features are safely filled with zero when training on the
public liveness dataset, and missing public-dataset timing features are safely
filled when a browser session does not include dwell/hold timings.
"""

from __future__ import annotations

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

FEATURE_COLUMNS = PUBLIC_TIMING_FEATURE_COLUMNS + TYPETRACE_LIVE_FEATURE_COLUMNS

MODEL_NAME = "TypeTrace Isolation Forest"
MODEL_VERSION = "isolation-forest-v1"
MINIMUM_KEYS_PER_SESSION = 20
MAX_VALID_TIMING_MS = 1500
MISSING_TIMING_MARKER = -1
