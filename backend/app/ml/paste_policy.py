"""Deterministic paste-contribution policy for TypeTrace analysis results.

The timing model and behavioral rule layer produce the pre-paste evidence score.
This module then applies a separate final-document paste policy using canonical
paste counts and pasted-character contribution.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional

from app.ml.inference_engine import classify_from_human_score


MINIMUM_KEYSTROKES = 30

PASTE_POLICY_VERSION = "paste-policy-v1"
LIGHT_PASTE_RATIO_THRESHOLD = 0.20
DOMINANT_PASTE_RATIO_THRESHOLD = 0.60
MODERATE_PASTE_MAX_HUMAN_SCORE = 79.99
DOMINANT_PASTE_MAX_HUMAN_SCORE = 20.0


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        if math.isnan(result) or math.isinf(result):
            return default
        return result
    except (TypeError, ValueError):
        return default


def _clamp_score(value: Any) -> float:
    return round(max(0.0, min(100.0, _safe_float(value))), 2)


def classify_paste_tier(
    *,
    paste_count: int,
    pasted_length: int,
    text_length: int,
    keydown_count: int,
) -> str:
    """Classify paste contribution using final-document character coverage."""

    if paste_count <= 0:
        return "NONE"

    if pasted_length <= 0:
        return "UNQUANTIFIED"

    ratio = min(pasted_length / max(text_length, 1), 1.0)
    if ratio >= DOMINANT_PASTE_RATIO_THRESHOLD:
        return "DOMINANT"
    if ratio >= LIGHT_PASTE_RATIO_THRESHOLD:
        return "MODERATE"
    if keydown_count < MINIMUM_KEYSTROKES:
        return "LIMITED_TYPED_EVIDENCE"
    return "LIGHT"


def apply_paste_policy(
    *,
    result: Any,
    event_counts: Dict[str, int],
    text_content: str,
    classification: str,
    confidence_score: float,
    risk_score: float,
    risk_level: str,
) -> Dict[str, Any]:
    """Apply the character-contribution paste policy.

    Paste is evaluated independently from timing-model fusion:

    - NONE: no paste policy adjustment.
    - LIGHT (<20%): evidence is recorded without forcing a category.
    - MODERATE (20%-<60%): HUMAN is capped to NEEDS REVIEW.
    - UNQUANTIFIED: a captured paste with missing length is capped to review.
    - LIMITED_TYPED_EVIDENCE: a light paste with too little direct typing is
      capped to review.
    - DOMINANT (>=60% of final characters): HIGH RISK.

    Existing high-risk evidence is never raised into a safer category. All final
    score, classification, risk, diagnostics, and explanation fields are updated
    together to prevent contradictory screens.
    """

    text_length = len(text_content or "")
    paste_count = max(0, int(event_counts.get("paste_count", 0)))
    pasted_length = max(0, int(event_counts.get("pasted_length", 0)))
    keydown_count = max(0, int(event_counts.get("keydown_count", 0)))

    raw_pasted_character_ratio = (
        pasted_length / text_length if text_length > 0 else 0.0
    )
    pasted_character_ratio = round(
        min(max(raw_pasted_character_ratio, 0.0), 1.0),
        4,
    )
    paste_tier = classify_paste_tier(
        paste_count=paste_count,
        pasted_length=pasted_length,
        text_length=text_length,
        keydown_count=keydown_count,
    )

    advanced_stats_value = getattr(result, "advanced_stats", None)
    advanced_stats = (
        dict(advanced_stats_value)
        if isinstance(advanced_stats_value, dict)
        else {}
    )

    pre_policy_decision = {
        "classification": classification,
        "confidence_score": _clamp_score(confidence_score),
        "human_score": _clamp_score(confidence_score),
        "risk_score": _clamp_score(risk_score),
        "risk_level": risk_level,
        "decision_source": str(
            advanced_stats.get("decision_source")
            or getattr(result, "decision_source", "analysis_engine")
        ),
    }

    final_human_score = _clamp_score(confidence_score)
    final_decision_source = pre_policy_decision["decision_source"]
    final_kill_switch_triggered = bool(
        getattr(result, "kill_switch_triggered", False)
    )
    final_kill_switch_reason = getattr(
        result,
        "kill_switch_reason",
        None,
    )
    paste_override_applied = False

    if paste_tier == "DOMINANT":
        final_human_score = min(
            final_human_score,
            DOMINANT_PASTE_MAX_HUMAN_SCORE,
        )
        final_decision_source = "paste_dominant_policy"
        final_kill_switch_triggered = True
        final_kill_switch_reason = (
            "Paste-dominant writing session detected."
        )
        paste_override_applied = True
    elif paste_tier == "MODERATE":
        final_human_score = min(
            final_human_score,
            MODERATE_PASTE_MAX_HUMAN_SCORE,
        )
        final_decision_source = "paste_moderate_review_cap"
        paste_override_applied = True
    elif paste_tier == "UNQUANTIFIED":
        final_human_score = min(
            final_human_score,
            MODERATE_PASTE_MAX_HUMAN_SCORE,
        )
        final_decision_source = "paste_unquantified_review_cap"
        paste_override_applied = True
    elif paste_tier == "LIMITED_TYPED_EVIDENCE":
        final_human_score = min(
            final_human_score,
            MODERATE_PASTE_MAX_HUMAN_SCORE,
        )
        final_decision_source = "paste_limited_typing_review_cap"
        paste_override_applied = True

    final_human_score = _clamp_score(final_human_score)
    final_labels = classify_from_human_score(final_human_score)
    final_classification = final_labels["classification"]
    final_risk_level = final_labels["risk_level"]
    final_risk_score = _clamp_score(100.0 - final_human_score)

    risk_signals = list(advanced_stats.get("risk_signals") or [])
    human_signals = list(advanced_stats.get("human_signals") or [])
    decision_notes = list(advanced_stats.get("decision_notes") or [])

    no_paste_signal = "No paste event was detected."
    if paste_tier != "NONE" and no_paste_signal in human_signals:
        human_signals.remove(no_paste_signal)

    paste_signal: Optional[str] = None
    if paste_tier == "LIGHT":
        decision_notes.append(
            "A limited paste contribution was recorded without forcing a "
            "review category."
        )
    elif paste_tier == "MODERATE":
        paste_signal = (
            "Paste activity contributed between 20% and 60% of the final "
            "document, so Human classification was capped at Needs Review."
        )
    elif paste_tier == "UNQUANTIFIED":
        paste_signal = (
            "Paste activity was detected, but its character contribution could "
            "not be measured reliably; Human classification was capped at "
            "Needs Review."
        )
    elif paste_tier == "LIMITED_TYPED_EVIDENCE":
        paste_signal = (
            "A limited paste contribution was detected, but too little direct "
            "typing evidence was captured for Human classification."
        )
    elif paste_tier == "DOMINANT":
        paste_signal = (
            "Most of the document was inserted through paste, or insufficient "
            "direct typing evidence was captured."
        )

    if paste_signal and paste_signal not in risk_signals:
        risk_signals.append(paste_signal)

    existing_diagnostics = advanced_stats.get("score_diagnostics")
    score_diagnostics = (
        dict(existing_diagnostics)
        if isinstance(existing_diagnostics, dict)
        else {}
    )
    score_diagnostics.update(
        {
            "paste_policy_version": PASTE_POLICY_VERSION,
            "paste_policy_applied": paste_tier != "NONE",
            "paste_override_applied": paste_override_applied,
            "paste_evidence": {
                "paste_tier": paste_tier,
                "paste_count": paste_count,
                "pasted_length": pasted_length,
                "text_length": text_length,
                "pasted_character_ratio": pasted_character_ratio,
                "raw_pasted_character_ratio": round(
                    raw_pasted_character_ratio,
                    6,
                ),
                "keydown_count": keydown_count,
                "minimum_keydown_requirement": MINIMUM_KEYSTROKES,
                "light_ratio_threshold": LIGHT_PASTE_RATIO_THRESHOLD,
                "dominant_ratio_threshold": (
                    DOMINANT_PASTE_RATIO_THRESHOLD
                ),
                "moderate_human_score_cap": (
                    MODERATE_PASTE_MAX_HUMAN_SCORE
                ),
                "dominant_human_score_cap": (
                    DOMINANT_PASTE_MAX_HUMAN_SCORE
                ),
            },
            # Preserve the Day 1 key for existing consumers.
            "pre_override_decision": pre_policy_decision,
            "pre_paste_policy_decision": pre_policy_decision,
            "final_decision": {
                "classification": final_classification,
                "confidence_score": final_human_score,
                "human_score": final_human_score,
                "risk_score": final_risk_score,
                "risk_level": final_risk_level,
                "decision_source": final_decision_source,
            },
        }
    )

    advanced_stats.update(
        {
            "paste_policy_version": PASTE_POLICY_VERSION,
            "paste_tier": paste_tier,
            "paste_count": paste_count,
            "pasted_length": pasted_length,
            "paste_ratio": pasted_character_ratio,
            "pasted_character_ratio": pasted_character_ratio,
            "raw_pasted_character_ratio": round(
                raw_pasted_character_ratio,
                6,
            ),
            "paste_dominant": paste_tier == "DOMINANT",
            "paste_policy_applied": paste_tier != "NONE",
            "paste_override_applied": paste_override_applied,
            "pre_override_decision": pre_policy_decision,
            "pre_paste_policy_decision": pre_policy_decision,
            "classification": final_classification,
            "confidence_score": final_human_score,
            "human_score": final_human_score,
            "risk_score": final_risk_score,
            "risk_level": final_risk_level,
            "risk_signals": risk_signals,
            "human_signals": human_signals,
            "decision_notes": decision_notes,
            "decision_source": final_decision_source,
            "score_diagnostics": score_diagnostics,
        }
    )

    if paste_tier == "DOMINANT":
        advanced_stats["academic_interpretation"] = (
            "The final document was dominated by paste activity. This is "
            "high-risk process "
            "evidence requiring human academic review; it is not automatic "
            "proof of misconduct."
        )
    elif paste_tier in {
        "MODERATE",
        "UNQUANTIFIED",
        "LIMITED_TYPED_EVIDENCE",
    }:
        advanced_stats["academic_interpretation"] = (
            "Material paste activity was detected, so the result cannot be "
            "classified as Human without review. Timing and revision evidence "
            "remain available to the reviewer."
        )

    return {
        "classification": final_classification,
        "confidence_score": final_human_score,
        "risk_score": final_risk_score,
        "risk_level": final_risk_level,
        "advanced_stats": advanced_stats,
        "kill_switch_triggered": final_kill_switch_triggered,
        "kill_switch_reason": final_kill_switch_reason,
    }