"""Regression checks for the Day 1 deterministic scoring fixes.

Run from the backend directory:

    python -m scripts.day1_scoring_regression

The script uses only deterministic, locally generated event streams. It does
not train the model or modify any project data.
"""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from typing import Dict, List

from app.ml.behavioral_analysis import compute_behavioral_summary
from app.ml.inference_engine import classify_from_human_score


def build_keydown_events(flight_times: List[float]) -> List[Dict[str, object]]:
    timestamp = 0.0
    events: List[Dict[str, object]] = []

    for index, flight_time in enumerate(flight_times):
        timestamp += max(float(flight_time), 1.0)
        events.append(
            {
                "type": "keydown",
                "key": chr(97 + (index % 26)),
                "timestamp": timestamp,
                "flight_time": float(flight_time),
                "dwell_time": 70.0 + float(index % 7) * 4.0,
            }
        )

    return events


def build_stats(
    *,
    wpm: float,
    keystrokes: int,
    deletions: int = 0,
    pauses: int = 0,
    session_seconds: float = 180.0,
) -> SimpleNamespace:
    return SimpleNamespace(
        wpm=wpm,
        keystrokes=keystrokes,
        deletions=deletions,
        pauses=pauses,
        sessionSeconds=session_seconds,
    )


class Day1ScoringRegressionTests(unittest.TestCase):
    def test_score_classification_boundaries_are_exact(self) -> None:
        self.assertEqual(
            classify_from_human_score(80.0),
            {"classification": "HUMAN", "risk_level": "LOW"},
        )
        self.assertEqual(
            classify_from_human_score(79.99),
            {"classification": "SUSPICIOUS", "risk_level": "MEDIUM"},
        )
        self.assertEqual(
            classify_from_human_score(50.0),
            {"classification": "SUSPICIOUS", "risk_level": "MEDIUM"},
        )
        self.assertEqual(
            classify_from_human_score(49.99),
            {"classification": "SYNTHETIC", "risk_level": "HIGH"},
        )

    def test_long_thinking_pause_is_excluded_from_rhythm_entropy(self) -> None:
        rhythm = [110, 145, 190, 260, 340, 480] * 10
        events = build_keydown_events([*rhythm, 9000])
        summary = compute_behavioral_summary(
            events=events,
            stats=build_stats(
                wpm=32,
                keystrokes=len(events),
                deletions=3,
                pauses=1,
                session_seconds=300,
            ),
            text_content="human writing " * 30,
        )

        self.assertEqual(summary["flight_count"], 61)
        self.assertEqual(summary["rhythm_flight_count"], 60)
        self.assertEqual(summary["thinking_pause_count"], 1)
        self.assertEqual(summary["longest_pause_ms"], 9000.0)
        self.assertFalse(summary["mechanically_uniform_rhythm"])
        self.assertNotIn(
            "Inter-key timing is unusually uniform across both variation and entropy.",
            summary["risk_signals"],
        )

    def test_low_entropy_alone_does_not_create_uniform_rhythm_risk(self) -> None:
        # Most values occupy one fixed entropy bin, but the outlying rhythm value
        # creates substantial variance. Low entropy without low variance must not
        # be treated as mechanically uniform.
        flight_times = [200] * 59 + [800]
        events = build_keydown_events(flight_times)
        summary = compute_behavioral_summary(
            events=events,
            stats=build_stats(
                wpm=28,
                keystrokes=len(events),
                deletions=2,
                pauses=1,
                session_seconds=260,
            ),
            text_content="controlled human text " * 25,
        )

        self.assertLess(summary["rhythm_flight_entropy"], 0.5)
        self.assertGreater(summary["rhythm_flight_std"], 15)
        self.assertFalse(summary["mechanically_uniform_rhythm"])
        self.assertEqual(
            summary["risk_contributions"]["mechanically_uniform_rhythm"],
            0.0,
        )
        self.assertNotIn(
            "Inter-key timing is unusually uniform across both variation and entropy.",
            summary["risk_signals"],
        )

    def test_uniform_rhythm_requires_both_low_variance_and_low_entropy(self) -> None:
        flight_times = [198 + (index % 5) for index in range(60)]
        events = build_keydown_events(flight_times)
        summary = compute_behavioral_summary(
            events=events,
            stats=build_stats(
                wpm=55,
                keystrokes=len(events),
                deletions=0,
                pauses=0,
                session_seconds=120,
            ),
            text_content="uniform timing sample " * 20,
        )

        self.assertTrue(summary["mechanically_uniform_rhythm"])
        self.assertGreater(
            summary["risk_contributions"]["mechanically_uniform_rhythm"],
            0.0,
        )
        self.assertIn(
            "Inter-key timing is unusually uniform across both variation and entropy.",
            summary["risk_signals"],
        )
        self.assertNotEqual(summary["risk_level"], "HIGH")

    def test_slow_human_typing_is_not_high_risk_by_speed_alone(self) -> None:
        flight_times = [180, 240, 320, 450, 620, 900] * 10 + [4200, 6100]
        events = build_keydown_events(flight_times)
        summary = compute_behavioral_summary(
            events=events,
            stats=build_stats(
                wpm=14,
                keystrokes=len(events),
                deletions=4,
                pauses=2,
                session_seconds=520,
            ),
            text_content="slow but genuine human writing " * 25,
        )

        self.assertEqual(
            summary["risk_contributions"]["extreme_typing_speed"],
            0.0,
        )
        self.assertFalse(summary["mechanically_uniform_rhythm"])
        self.assertEqual(summary["risk_level"], "LOW")
        self.assertIn(
            "Thinking pauses were observed during writing.",
            summary["human_signals"],
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)