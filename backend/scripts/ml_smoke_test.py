"""Run one deterministic inference smoke test against loaded model artifacts."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from app.ml.inference_engine import inference_engine


SAMPLE_TEXT = (
    "This is a short human-style writing sample for TypeTrace analysis."
)


def build_sample_events() -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    timestamp = 0

    for index, char in enumerate(SAMPLE_TEXT):
        timestamp += 140 + (index % 5) * 35
        events.append(
            {
                "type": "keydown",
                "key": char,
                "timestamp": timestamp,
                "dwell_time": 80 + (index % 4) * 12,
                "flight_time": 120 + (index % 6) * 25,
                "documentLength": index + 1,
                "cursorPosition": index + 1,
            }
        )

    return events


def build_sample_stats(events: list[dict[str, Any]]) -> SimpleNamespace:
    return SimpleNamespace(
        wpm=42.0,
        keystrokes=len(events),
        deletions=0,
        deletedCharacters=0,
        pauses=2,
        avgIki=180.0,
        sessionSeconds=75.0,
        textLength=len(SAMPLE_TEXT),
    )


def main() -> int:
    model_status = inference_engine.get_status()
    if (
        model_status.get("status") != "ready"
        or model_status.get("model_available") is not True
    ):
        print("Model smoke test failed: production artifacts are not ready.")
        print("Model status:", model_status)
        return 1

    events = build_sample_events()
    result = inference_engine.analyze(
        events=events,
        stats=build_sample_stats(events),
        text_content=SAMPLE_TEXT,
    )

    if result.decision_source == "fallback_rules":
        print("Model smoke test failed: inference used fallback rules.")
        return 1

    if result.classification not in {"HUMAN", "SUSPICIOUS", "SYNTHETIC"}:
        print(
            "Model smoke test failed: invalid classification",
            result.classification,
        )
        return 1

    if not 0.0 <= float(result.confidence_score) <= 100.0:
        print("Model smoke test failed: confidence score is out of range.")
        return 1

    print("Classification:", result.classification)
    print("Human evidence score:", result.confidence_score)
    print("Risk level:", result.risk_level)
    print("Risk score:", result.risk_score)
    print("Decision source:", result.decision_source)
    print("Model version:", model_status.get("model_version"))
    print("Result: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
