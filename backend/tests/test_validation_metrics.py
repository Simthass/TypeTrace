"""Unit tests for TypeTrace controlled-validation reporting helpers."""

from __future__ import annotations

import unittest

from scripts.validation_pipeline import (
    ScenarioDefinition,
    classification_counts,
    rate_metric,
    scenario_for_title,
    pseudonymous_account_id,
    scenario_metrics,
    score_distribution,
    validate_input_set,
    wilson_interval,
)


def result_row(
    classification: str,
    score: float,
    paste_ratio: float = 0.0,
) -> dict[str, object]:
    return {
        "frozen_classification": classification,
        "frozen_human_score": score,
        "pasted_character_ratio": paste_ratio,
    }


class ValidationMetricTests(unittest.TestCase):
    def test_wilson_interval_is_bounded(self) -> None:
        lower, upper = wilson_interval(5, 10)
        self.assertGreaterEqual(lower, 0.0)
        self.assertLessEqual(upper, 1.0)
        self.assertLess(lower, 0.5)
        self.assertGreater(upper, 0.5)

    def test_rate_metric_preserves_counts_and_percent(self) -> None:
        metric = rate_metric(3, 4)
        self.assertEqual(metric["numerator"], 3)
        self.assertEqual(metric["denominator"], 4)
        self.assertEqual(metric["rate"], 0.75)
        self.assertEqual(metric["percent"], 75.0)

    def test_score_distribution_is_deterministic(self) -> None:
        distribution = score_distribution([10.0, 20.0, 30.0, 40.0])
        self.assertEqual(distribution["minimum"], 10.0)
        self.assertEqual(distribution["median"], 25.0)
        self.assertEqual(distribution["maximum"], 40.0)
        self.assertEqual(distribution["mean"], 25.0)

    def test_scenario_prefix_matching_is_case_insensitive(self) -> None:
        scenarios = (
            ScenarioDefinition(
                key="TT-HUMAN",
                title_prefix="TT-HUMAN",
                expected_count=1,
                interpretation="Human scenario.",
            ),
        )
        scenario = scenario_for_title("  tt-human 001", scenarios)
        self.assertEqual(scenario.key, "TT-HUMAN")

    def test_multiple_accounts_remain_one_declared_participant(self) -> None:
        scenarios = (
            ScenarioDefinition(
                key="TT-HUMAN",
                title_prefix="TT-HUMAN",
                expected_count=2,
                interpretation="Human scenario.",
            ),
        )
        rows = [
            {"id": 1, "user_id": "account-a", "title": "TT-HUMAN-001"},
            {"id": 2, "user_id": "account-b", "title": "TT-HUMAN-002"},
        ]

        summary = validate_input_set(
            rows,
            scenarios,
            allow_count_mismatch=False,
            allow_multiple_accounts=True,
        )

        self.assertEqual(summary["participant_count"], 1)
        self.assertEqual(summary["account_count"], 2)
        self.assertEqual(len(summary["account_hashes"]), 2)
        self.assertNotIn("writer_count", summary)

    def test_account_hash_is_stable_and_pseudonymous(self) -> None:
        first = pseudonymous_account_id("account-a")
        second = pseudonymous_account_id("account-a")

        self.assertEqual(first, second)
        self.assertEqual(len(first), 16)
        self.assertNotEqual(first, "account-a")

    def test_human_scenario_reports_high_risk_safety_measure(self) -> None:
        scenario = ScenarioDefinition(
            key="TT-HUMAN",
            title_prefix="TT-HUMAN",
            expected_count=3,
            interpretation="Human scenario.",
        )
        rows = [
            result_row("HUMAN", 90.0),
            result_row("SUSPICIOUS", 70.0),
            result_row("SYNTHETIC", 30.0),
        ]

        self.assertEqual(
            classification_counts(rows),
            {
                "HUMAN": 1,
                "SUSPICIOUS": 1,
                "SYNTHETIC": 1,
            },
        )

        metrics = scenario_metrics(scenario, rows)
        self.assertEqual(
            metrics["measures"]["incorrect_high_risk_rate"]["numerator"],
            1,
        )
        self.assertEqual(
            metrics["measures"]["protected_from_high_risk_rate"]["numerator"],
            2,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
