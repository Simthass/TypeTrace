# backend/scripts/ml_smoke_test.py

from types import SimpleNamespace

from app.ml.inference_engine import inference_engine


def build_sample_events():
    events = []
    timestamp = 0

    text = "This is a short human style writing sample for TypeTrace analysis."

    for index, char in enumerate(text):
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


def build_sample_stats(events):
    text = "This is a short human style writing sample for TypeTrace analysis."

    return SimpleNamespace(
        wpm=42.0,
        keystrokes=len(events),
        deletions=0,
        pauses=2,
        avgIki=180.0,
        sessionSeconds=75.0,
        textLength=len(text),
    )


def main():
    text_content = "This is a short human style writing sample for TypeTrace analysis."
    events = build_sample_events()
    stats = build_sample_stats(events)

    result = inference_engine.analyze(
        events=events,
        stats=stats,
        text_content=text_content,
    )

    print("Classification:", result.classification)
    print("Confidence:", result.confidence_score)
    print("Risk level:", result.risk_level)
    print("Risk score:", result.risk_score)
    print("Decision source:", result.decision_source)
    print("Kill switch:", result.kill_switch_triggered)
    print("Reason:", result.kill_switch_reason)
    print("Model status:", inference_engine.get_status())


if __name__ == "__main__":
    main()