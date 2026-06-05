# backend/app/ml/behavioral_analysis.py

import math
from statistics import mean, median, pstdev
from typing import Any, Dict, List, Optional


MAX_HUMAN_REASONABLE_WPM = 180
HIGH_PASTE_COUNT = 3
VERY_LOW_IKI_STD = 15
VERY_LOW_IKI_ENTROPY = 0.5
LONG_PAUSE_MS = 2000


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        if math.isnan(result) or math.isinf(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _round(value: Any, digits: int = 2) -> float:
    return round(_safe_float(value), digits)


def _entropy(values: List[float], bins: int = 10) -> float:
    if not values:
        return 0.0

    min_v = min(values)
    max_v = max(values)

    if min_v == max_v:
        return 0.0

    width = (max_v - min_v) / bins
    counts = [0] * bins

    for value in values:
      index = min(int((value - min_v) / width), bins - 1)
      counts[index] += 1

    total = sum(counts)
    if total == 0:
        return 0.0

    entropy = 0.0
    for count in counts:
        if count == 0:
            continue
        probability = count / total
        entropy -= probability * math.log2(probability)

    return entropy


def _extract_timing_values(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    keydown_events: List[Dict[str, Any]] = []
    dwell_values: List[float] = []
    flight_values: List[float] = []
    paste_count = 0

    for event in events:
        if not isinstance(event, dict):
            continue

        if event.get("key") == "__PASTE_EVENT__" or event.get("type") == "paste":
            paste_count += 1
            continue

        if event.get("type") != "keydown":
            continue

        keydown_events.append(event)

        dwell_time = event.get("dwell_time")
        if dwell_time is not None:
            dwell = _safe_float(dwell_time)
            if 10 <= dwell <= 2000:
                dwell_values.append(dwell)

        flight_time = event.get("flight_time")
        if flight_time is not None:
            flight = _safe_float(flight_time)
            if 1 <= flight <= 30000:
                flight_values.append(flight)

    return {
        "keydown_events": keydown_events,
        "dwell_values": dwell_values,
        "flight_values": flight_values,
        "paste_count": paste_count,
    }


def _build_signal_list(
    *,
    wpm: float,
    paste_count: int,
    flight_std: float,
    flight_entropy: float,
    deletion_ratio: float,
    pause_ratio: float,
    dwell_count: int,
    flight_count: int,
) -> Dict[str, List[str]]:
    risk_signals: List[str] = []
    human_signals: List[str] = []

    if wpm > MAX_HUMAN_REASONABLE_WPM:
        risk_signals.append("Typing speed is above the realistic human range.")

    if paste_count > HIGH_PASTE_COUNT:
        risk_signals.append("Multiple paste events were detected.")

    if flight_count >= 30 and flight_std < VERY_LOW_IKI_STD:
        risk_signals.append("Inter-key timing is mechanically uniform.")

    if flight_count >= 50 and flight_entropy < VERY_LOW_IKI_ENTROPY:
        risk_signals.append("Typing rhythm has very low entropy.")

    if deletion_ratio < 0.01 and flight_count >= 50:
        risk_signals.append("Very little revision behavior was observed.")

    if pause_ratio < 0.01 and flight_count >= 50:
        risk_signals.append("Very few thinking pauses were observed.")

    if 20 <= wpm <= 120:
        human_signals.append("Typing speed is within a realistic human range.")

    if dwell_count >= 20:
        human_signals.append("Dwell-time evidence is available for key presses.")

    if flight_count >= 30 and flight_std >= 25:
        human_signals.append("Inter-key timing contains natural human variation.")

    if deletion_ratio >= 0.02:
        human_signals.append("Revision behavior was observed through deletions.")

    if pause_ratio >= 0.03:
        human_signals.append("Thinking pauses were observed during writing.")

    if paste_count == 0:
        human_signals.append("No paste event was detected.")

    return {
        "risk_signals": risk_signals,
        "human_signals": human_signals,
    }


def compute_behavioral_summary(
    *,
    events: List[Dict[str, Any]],
    stats: Any,
    text_content: str,
    model_features: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    model_features = model_features or {}

    extracted = _extract_timing_values(events)
    keydown_events = extracted["keydown_events"]
    dwell_values = extracted["dwell_values"]
    flight_values = extracted["flight_values"]
    paste_count = extracted["paste_count"]

    total_keys = len(keydown_events)
    deletions = _safe_float(getattr(stats, "deletions", 0))
    pauses = _safe_float(getattr(stats, "pauses", 0))
    wpm = _safe_float(getattr(stats, "wpm", 0))
    session_seconds = _safe_float(getattr(stats, "sessionSeconds", 0))

    deletion_ratio = deletions / max(total_keys, 1)
    pause_ratio = pauses / max(total_keys, 1)
    paste_ratio = paste_count / max(total_keys, 1)

    dwell_mean = mean(dwell_values) if dwell_values else 0.0
    dwell_std = pstdev(dwell_values) if len(dwell_values) > 1 else 0.0
    dwell_median = median(dwell_values) if dwell_values else 0.0

    flight_mean = mean(flight_values) if flight_values else 0.0
    flight_std = pstdev(flight_values) if len(flight_values) > 1 else 0.0
    flight_median = median(flight_values) if flight_values else 0.0
    flight_entropy = _entropy(flight_values)

    long_pauses = [value for value in flight_values if value >= LONG_PAUSE_MS]
    longest_pause = max(long_pauses) if long_pauses else 0.0

    signals = _build_signal_list(
        wpm=wpm,
        paste_count=paste_count,
        flight_std=flight_std,
        flight_entropy=flight_entropy,
        deletion_ratio=deletion_ratio,
        pause_ratio=pause_ratio,
        dwell_count=len(dwell_values),
        flight_count=len(flight_values),
    )

    risk_score = 0.0

    if wpm > 120:
        risk_score += min((wpm - 120) / 120, 1.0) * 22

    if paste_count > 0:
        risk_score += min(paste_count / 5, 1.0) * 18

    if len(flight_values) >= 30 and flight_std < 30:
        risk_score += min((30 - flight_std) / 30, 1.0) * 20

    if len(flight_values) >= 50 and flight_entropy < 1.0:
        risk_score += min((1.0 - flight_entropy) / 1.0, 1.0) * 16

    if deletion_ratio < 0.01 and total_keys >= 50:
        risk_score += 10

    if pause_ratio < 0.01 and total_keys >= 50:
        risk_score += 10

    if len(dwell_values) < 10 and total_keys >= 50:
        risk_score += 4

    risk_score = round(min(max(risk_score, 0.0), 100.0), 1)

    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "total_keys": total_keys,
        "text_length": len(text_content or ""),
        "session_seconds": round(session_seconds, 2),
        "wpm": round(wpm, 2),
        "paste_count": paste_count,
        "paste_ratio": round(paste_ratio, 4),
        "deletion_ratio": round(deletion_ratio, 4),
        "pause_ratio": round(pause_ratio, 4),
        "dwell_count": len(dwell_values),
        "dwell_mean": round(dwell_mean, 2),
        "dwell_std": round(dwell_std, 2),
        "dwell_median": round(dwell_median, 2),
        "flight_count": len(flight_values),
        "flight_mean": round(flight_mean, 2),
        "flight_std": round(flight_std, 2),
        "flight_median": round(flight_median, 2),
        "flight_entropy": round(flight_entropy, 4),
        "longest_pause_ms": round(longest_pause, 2),
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_signals": signals["risk_signals"],
        "human_signals": signals["human_signals"],
        "model_feature_snapshot": {
            "ht_mean": _round(model_features.get("ht_mean")),
            "ht_std": _round(model_features.get("ht_std")),
            "ft_mean": _round(model_features.get("ft_mean")),
            "ft_std": _round(model_features.get("ft_std")),
            "ft_entropy": _round(model_features.get("ft_entropy"), 4),
            "ft_autocorr": _round(model_features.get("ft_autocorr"), 4),
            "burst_ratio": _round(model_features.get("burst_ratio"), 4),
            "net_wpm": _round(model_features.get("net_wpm")),
        },
    }


def build_feature_explanations(features: Dict[str, Any]) -> Dict[str, str]:
    return {
        "ht_mean": "Average key hold time. Human typing usually has natural variation across keys.",
        "ht_std": "Variation in key hold time. Extremely low variation may suggest automation.",
        "ft_mean": "Average inter-key interval. This reflects rhythm between consecutive key presses.",
        "ft_std": "Variation in inter-key interval. Human writing normally contains uneven rhythm.",
        "ft_entropy": "Randomness of inter-key timing. Low entropy suggests repetitive mechanical rhythm.",
        "ft_autocorr": "Similarity between consecutive inter-key intervals. High structure may indicate patterned input.",
        "burst_ratio": "Share of fast typing bursts. Natural writing alternates between bursts and pauses.",
        "pause_ratio": "Share of thinking pauses. Very low pause behavior can be suspicious in long writing.",
        "net_wpm": "Estimated net writing speed from final text length and session duration.",
    }