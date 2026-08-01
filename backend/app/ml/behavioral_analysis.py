import math
from statistics import mean, median, pstdev
from typing import Any, Dict, List, Optional

from app.services.canonical_evidence import is_writing_keydown_event


MAX_HUMAN_REASONABLE_WPM = 180
HIGH_PASTE_COUNT = 3

# Rhythm analysis must use the same upper timing boundary as the public
# liveness dataset. Longer intervals represent thinking/idle pauses and must not
# stretch the entropy histogram used to judge inter-key rhythm.
RHYTHM_MAX_FLIGHT_MS = 1500
MAX_CAPTURED_FLIGHT_MS = 30000
THINKING_PAUSE_MIN_MS = RHYTHM_MAX_FLIGHT_MS

MIN_RHYTHM_SAMPLES_FOR_VARIATION = 30
MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY = 50
VERY_LOW_IKI_STD = 15
VERY_LOW_IKI_ENTROPY = 0.5
NATURAL_IKI_STD = 25
NATURAL_IKI_ENTROPY = 1.0

LIGHT_PASTE_RATIO_THRESHOLD = 0.20
DOMINANT_PASTE_RATIO_THRESHOLD = 0.60


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


def _entropy(
    values: List[float],
    *,
    bins: int = 10,
    minimum: float = 0.0,
    maximum: float = RHYTHM_MAX_FLIGHT_MS,
) -> float:
    """Return Shannon entropy for a fixed timing range.

    Fixed-width bins make scores comparable between sessions. The previous
    implementation derived bins from each session's minimum and maximum, so a
    single long pause could stretch the range and collapse ordinary timings
    into one bin, incorrectly producing a very-low-entropy warning.
    """

    if not values or bins <= 0 or maximum <= minimum:
        return 0.0

    width = (maximum - minimum) / bins
    counts = [0] * bins

    for value in values:
        numeric = _safe_float(value, default=float("nan"))
        if math.isnan(numeric) or numeric < minimum or numeric > maximum:
            continue

        index = min(int((numeric - minimum) / width), bins - 1)
        counts[index] += 1

    total = sum(counts)
    if total <= 0:
        return 0.0

    entropy = 0.0
    for count in counts:
        if count <= 0:
            continue
        probability = count / total
        entropy -= probability * math.log2(probability)

    return entropy


def _event_pasted_length(event: Dict[str, Any]) -> int:
    """Return the best available character count for a captured paste event."""

    for key in ("pastedLength", "insertedCharacters", "deltaLength"):
        value = _safe_float(event.get(key), 0.0)
        if value > 0:
            return max(0, int(round(value)))

    inserted_text = event.get("insertedText", event.get("inserted_text"))
    if isinstance(inserted_text, str):
        return len(inserted_text)

    return 0


def _extract_timing_values(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    keydown_events: List[Dict[str, Any]] = []
    dwell_values: List[float] = []
    all_flight_values: List[float] = []
    rhythm_flight_values: List[float] = []
    thinking_pause_values: List[float] = []
    paste_count = 0
    pasted_length = 0

    for event in events:
        if not isinstance(event, dict):
            continue

        event_type = str(event.get("type") or "").lower()
        event_key = event.get("key")

        if event_key == "__PASTE_EVENT__" or event_type == "paste":
            paste_count += 1
            pasted_length += _event_pasted_length(event)
            continue

        if event_type != "keydown" or not is_writing_keydown_event(event):
            continue

        keydown_events.append(event)

        dwell_time = event.get("dwell_time")
        if dwell_time is not None:
            dwell = _safe_float(dwell_time)
            if 10 <= dwell <= 2000:
                dwell_values.append(dwell)

        flight_time = event.get("flight_time")
        if flight_time is None:
            continue

        flight = _safe_float(flight_time)
        if not 1 <= flight <= MAX_CAPTURED_FLIGHT_MS:
            continue

        all_flight_values.append(flight)
        if flight <= RHYTHM_MAX_FLIGHT_MS:
            rhythm_flight_values.append(flight)
        else:
            thinking_pause_values.append(flight)

    return {
        "keydown_events": keydown_events,
        "dwell_values": dwell_values,
        "flight_values": all_flight_values,
        "rhythm_flight_values": rhythm_flight_values,
        "thinking_pause_values": thinking_pause_values,
        "paste_count": paste_count,
        "pasted_length": pasted_length,
    }


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        result = int(round(float(value)))
        return max(0, result)
    except (TypeError, ValueError):
        return default


def _is_keyup_event(event: Dict[str, Any]) -> bool:
    return str(event.get("type") or "").lower() == "keyup"


def _is_delete_keydown_event(event: Dict[str, Any]) -> bool:
    return (
        str(event.get("type") or "").lower() == "keydown"
        and event.get("key") in {"Backspace", "Delete"}
    )


def _event_deleted_characters(event: Dict[str, Any]) -> int:
    if _is_keyup_event(event):
        return 0

    has_explicit = "chars_deleted" in event or "deletedCharacters" in event
    if has_explicit:
        explicit = event.get("chars_deleted", event.get("deletedCharacters"))
        value = _safe_float(explicit, 0.0)
        return max(0, int(round(value)))
    if _is_delete_keydown_event(event):
        return 1
    return 0


def _compute_revision_metrics(events: List[Dict[str, Any]], stats: Any) -> Dict[str, Any]:
    revisions: Dict[str, Dict[str, Any]] = {}

    for index, event in enumerate(events):
        if not isinstance(event, dict):
            continue

        deleted = _event_deleted_characters(event)
        method = str(event.get("deletion_method") or "unknown").lower()
        has_explicit_deletion_count = (
            "chars_deleted" in event or "deletedCharacters" in event
        )
        has_revision_signal = (
            not _is_keyup_event(event)
            and (
                deleted > 0
                or (
                    _is_delete_keydown_event(event)
                    and not has_explicit_deletion_count
                )
                or event.get("key") in {"__CUT_EVENT__", "__TEXT_REVISION__"}
                or method != "unknown"
            )
        )
        if not has_revision_signal:
            continue

        revision_id = str(
            event.get("revision_id")
            or f"{event.get('timestamp', 0)}-{event.get('type', '')}-{event.get('key', '')}-{index}"
        )
        selection_len = _safe_int(event.get("selection_length_before"))
        bulk = bool(event.get("isBulkDeletion") or event.get("bulk_deletion"))

        existing = revisions.setdefault(
            revision_id,
            {
                "deleted": 0,
                "method": method,
                "selection": 0,
                "bulk": False,
                "cut": False,
            },
        )
        existing["deleted"] = max(int(existing["deleted"]), deleted)
        existing["selection"] = max(int(existing["selection"]), selection_len)
        existing["bulk"] = bool(existing["bulk"]) or bulk or deleted >= 2 or method in {
            "word",
            "line",
            "selection",
            "replacement",
            "cut",
            "all",
        }
        existing["cut"] = (
            bool(existing["cut"]) or method == "cut" or event.get("type") == "cut"
        )
        if existing["method"] == "unknown" and method != "unknown":
            existing["method"] = method

    values = list(revisions.values())

    fallback_actions = (
        _safe_int(getattr(stats, "deletions", 0)) if stats is not None else 0
    )
    delete_actions = len(values) if values else fallback_actions
    deleted_characters = sum(int(item["deleted"]) for item in values)

    if deleted_characters <= 0 and fallback_actions > 0:
        deleted_characters = fallback_actions

    return {
        "delete_actions": delete_actions,
        "deleted_characters": deleted_characters,
        "bulk_deletion_events": sum(1 for item in values if item["bulk"]),
        "largest_deletion_chars": max([int(item["deleted"]) for item in values] or [0]),
        "selection_deletion_events": sum(
            1
            for item in values
            if int(item["selection"]) > 0
            or item["method"] in {"selection", "replacement", "all"}
        ),
        "word_deletion_events": sum(1 for item in values if item["method"] == "word"),
        "cut_events": sum(1 for item in values if item["cut"]),
    }


def _build_signal_list(
    *,
    wpm: float,
    paste_count: int,
    pasted_character_ratio: float,
    rhythm_flight_std: float,
    rhythm_flight_entropy: float,
    deletion_ratio: float,
    deleted_character_ratio: float,
    revision_intensity: float,
    pause_ratio: float,
    dwell_count: int,
    rhythm_flight_count: int,
    thinking_pause_count: int,
) -> Dict[str, List[str]]:
    risk_signals: List[str] = []
    human_signals: List[str] = []

    mechanically_uniform = (
        rhythm_flight_count >= MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY
        and rhythm_flight_std < VERY_LOW_IKI_STD
        and rhythm_flight_entropy < VERY_LOW_IKI_ENTROPY
    )

    if wpm > MAX_HUMAN_REASONABLE_WPM:
        risk_signals.append("Typing speed is above the realistic human range.")

    if pasted_character_ratio >= DOMINANT_PASTE_RATIO_THRESHOLD:
        risk_signals.append(
            "Paste activity contributed most of the final document."
        )
    elif pasted_character_ratio >= LIGHT_PASTE_RATIO_THRESHOLD:
        risk_signals.append(
            "Paste activity contributed a substantial portion of the final document."
        )
    elif paste_count > HIGH_PASTE_COUNT:
        risk_signals.append(
            "Multiple limited paste events were detected."
        )

    if mechanically_uniform:
        risk_signals.append(
            "Inter-key timing is unusually uniform across both variation and entropy."
        )

    if (
        revision_intensity < 0.01
        and deletion_ratio < 0.01
        and rhythm_flight_count >= MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY
    ):
        risk_signals.append("Very little revision behavior was observed.")

    if (
        thinking_pause_count == 0
        and pause_ratio < 0.01
        and rhythm_flight_count >= MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY
    ):
        risk_signals.append("Very few thinking pauses were observed.")

    if 20 <= wpm <= 120:
        human_signals.append("Typing speed is within a realistic human range.")

    if dwell_count >= 20:
        human_signals.append("Dwell-time evidence is available for key presses.")

    natural_variation = (
        rhythm_flight_count >= MIN_RHYTHM_SAMPLES_FOR_VARIATION
        and not mechanically_uniform
        and (
            rhythm_flight_std >= NATURAL_IKI_STD
            or rhythm_flight_entropy >= NATURAL_IKI_ENTROPY
        )
    )
    if natural_variation:
        human_signals.append("Inter-key timing contains natural human variation.")

    if (
        deletion_ratio >= 0.02
        or revision_intensity >= 0.02
        or deleted_character_ratio >= 0.02
    ):
        human_signals.append("Revision behavior was observed through deletions.")

    if thinking_pause_count > 0 or pause_ratio >= 0.03:
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
    all_flight_values = extracted["flight_values"]
    rhythm_flight_values = extracted["rhythm_flight_values"]
    thinking_pause_values = extracted["thinking_pause_values"]
    paste_count = extracted["paste_count"]
    pasted_length = extracted["pasted_length"]

    total_keys = len(keydown_events)
    revision_metrics = _compute_revision_metrics(events, stats)
    deletions = _safe_float(revision_metrics.get("delete_actions", 0))
    deleted_characters = _safe_float(revision_metrics.get("deleted_characters", 0))
    pauses = _safe_float(getattr(stats, "pauses", 0))
    wpm = _safe_float(getattr(stats, "wpm", 0))
    session_seconds = _safe_float(getattr(stats, "sessionSeconds", 0))
    text_length = len(text_content or "")

    deletion_ratio = deletions / max(total_keys, 1)
    deleted_character_ratio = deleted_characters / max(text_length, 1)
    revision_intensity = deleted_characters / max(text_length + deleted_characters, 1)
    pause_ratio = pauses / max(total_keys, 1)
    paste_event_ratio = paste_count / max(total_keys, 1)
    pasted_character_ratio = min(
        pasted_length / max(text_length, 1),
        1.0,
    )

    dwell_mean = mean(dwell_values) if dwell_values else 0.0
    dwell_std = pstdev(dwell_values) if len(dwell_values) > 1 else 0.0
    dwell_median = median(dwell_values) if dwell_values else 0.0

    # Preserve the existing all-flight fields for backward compatibility.
    all_flight_mean = mean(all_flight_values) if all_flight_values else 0.0
    all_flight_std = (
        pstdev(all_flight_values) if len(all_flight_values) > 1 else 0.0
    )
    all_flight_median = median(all_flight_values) if all_flight_values else 0.0
    all_flight_entropy = _entropy(
        all_flight_values,
        maximum=MAX_CAPTURED_FLIGHT_MS,
    )

    # Risk decisions use only rhythm intervals. Thinking pauses are evaluated as
    # separate positive/negative writing-process evidence.
    rhythm_flight_mean = (
        mean(rhythm_flight_values) if rhythm_flight_values else 0.0
    )
    rhythm_flight_std = (
        pstdev(rhythm_flight_values) if len(rhythm_flight_values) > 1 else 0.0
    )
    rhythm_flight_median = (
        median(rhythm_flight_values) if rhythm_flight_values else 0.0
    )
    rhythm_flight_entropy = _entropy(rhythm_flight_values)

    longest_pause = max(thinking_pause_values) if thinking_pause_values else 0.0

    signals = _build_signal_list(
        wpm=wpm,
        paste_count=paste_count,
        pasted_character_ratio=pasted_character_ratio,
        rhythm_flight_std=rhythm_flight_std,
        rhythm_flight_entropy=rhythm_flight_entropy,
        deletion_ratio=deletion_ratio,
        deleted_character_ratio=deleted_character_ratio,
        revision_intensity=revision_intensity,
        pause_ratio=pause_ratio,
        dwell_count=len(dwell_values),
        rhythm_flight_count=len(rhythm_flight_values),
        thinking_pause_count=len(thinking_pause_values),
    )

    mechanically_uniform = (
        len(rhythm_flight_values) >= MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY
        and rhythm_flight_std < VERY_LOW_IKI_STD
        and rhythm_flight_entropy < VERY_LOW_IKI_ENTROPY
    )

    risk_contributions: Dict[str, float] = {
        "extreme_typing_speed": 0.0,
        "paste_events": 0.0,
        "mechanically_uniform_rhythm": 0.0,
        "minimal_revision": 0.0,
        "minimal_thinking_pauses": 0.0,
        "insufficient_dwell_evidence": 0.0,
    }

    if wpm > 120:
        risk_contributions["extreme_typing_speed"] = (
            min((wpm - 120) / 120, 1.0) * 22
        )

    if paste_count > 0:
        if pasted_character_ratio >= DOMINANT_PASTE_RATIO_THRESHOLD:
            risk_contributions["paste_events"] = 28.0
        elif pasted_character_ratio >= LIGHT_PASTE_RATIO_THRESHOLD:
            risk_contributions["paste_events"] = 16.0
        elif pasted_length >= 50 or paste_count > 1:
            risk_contributions["paste_events"] = 5.0
        else:
            risk_contributions["paste_events"] = 2.0

    # Low entropy is not penalised independently. It must be corroborated by
    # extremely low timing variation over a sufficiently large rhythm sample.
    if mechanically_uniform:
        risk_contributions["mechanically_uniform_rhythm"] = 24.0

    if (
        revision_intensity < 0.01
        and deletion_ratio < 0.01
        and total_keys >= MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY
    ):
        risk_contributions["minimal_revision"] = 10.0

    if (
        len(thinking_pause_values) == 0
        and pause_ratio < 0.01
        and total_keys >= MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY
    ):
        risk_contributions["minimal_thinking_pauses"] = 10.0

    if len(dwell_values) < 10 and total_keys >= MIN_RHYTHM_SAMPLES_FOR_UNIFORMITY:
        risk_contributions["insufficient_dwell_evidence"] = 4.0

    risk_score = round(
        min(max(sum(risk_contributions.values()), 0.0), 100.0),
        1,
    )

    if risk_score >= 70:
        risk_level = "HIGH"
    elif risk_score >= 40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "total_keys": total_keys,
        "text_length": text_length,
        "session_seconds": round(session_seconds, 2),
        "wpm": round(wpm, 2),
        "paste_count": paste_count,
        "pasted_length": pasted_length,
        "paste_ratio": round(pasted_character_ratio, 4),
        "pasted_character_ratio": round(pasted_character_ratio, 4),
        "paste_event_ratio": round(paste_event_ratio, 4),
        "deletion_ratio": round(deletion_ratio, 4),
        "deletion_action_ratio": round(deletion_ratio, 4),
        "deleted_characters": int(deleted_characters),
        "deleted_character_ratio": round(deleted_character_ratio, 4),
        "revision_intensity": round(revision_intensity, 4),
        "bulk_deletion_events": int(
            revision_metrics.get("bulk_deletion_events", 0)
        ),
        "largest_deletion_chars": int(
            revision_metrics.get("largest_deletion_chars", 0)
        ),
        "selection_deletion_events": int(
            revision_metrics.get("selection_deletion_events", 0)
        ),
        "word_deletion_events": int(
            revision_metrics.get("word_deletion_events", 0)
        ),
        "cut_events": int(revision_metrics.get("cut_events", 0)),
        "pause_ratio": round(pause_ratio, 4),
        "dwell_count": len(dwell_values),
        "dwell_mean": round(dwell_mean, 2),
        "dwell_std": round(dwell_std, 2),
        "dwell_median": round(dwell_median, 2),
        # Existing all-flight fields remain available to avoid breaking callers.
        "flight_count": len(all_flight_values),
        "flight_mean": round(all_flight_mean, 2),
        "flight_std": round(all_flight_std, 2),
        "flight_median": round(all_flight_median, 2),
        "flight_entropy": round(all_flight_entropy, 4),
        # New deterministic rhythm fields are the values used by the rules.
        "rhythm_flight_count": len(rhythm_flight_values),
        "rhythm_flight_mean": round(rhythm_flight_mean, 2),
        "rhythm_flight_std": round(rhythm_flight_std, 2),
        "rhythm_flight_median": round(rhythm_flight_median, 2),
        "rhythm_flight_entropy": round(rhythm_flight_entropy, 4),
        "rhythm_max_flight_ms": RHYTHM_MAX_FLIGHT_MS,
        "thinking_pause_count": len(thinking_pause_values),
        "longest_pause_ms": round(longest_pause, 2),
        "mechanically_uniform_rhythm": mechanically_uniform,
        "risk_contributions": {
            key: round(value, 2) for key, value in risk_contributions.items()
        },
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
        "ft_mean": "Average inter-key interval within the rhythm window. Thinking pauses are analysed separately.",
        "ft_std": "Variation in normal inter-key rhythm. Low variation matters only when corroborated by low entropy.",
        "ft_entropy": "Randomness of normal inter-key rhythm. Low entropy alone is not treated as high-risk evidence.",
        "ft_autocorr": "Similarity between consecutive inter-key intervals. High structure may indicate patterned input.",
        "burst_ratio": "Share of fast typing bursts. Natural writing often alternates between bursts and pauses.",
        "pause_ratio": "Share of thinking pauses. Pauses are separated from normal rhythm before entropy is calculated.",
        "net_wpm": "Estimated net writing speed from final text length and session duration.",
    }
