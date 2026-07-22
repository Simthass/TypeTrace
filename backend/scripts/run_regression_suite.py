"""Run the complete deterministic TypeTrace scoring regression gate.

Run from the backend directory:

    python -m scripts.run_regression_suite

The suite combines the existing deterministic checks with the frozen scoring
contract tests. It does not access the database, retrain the model, or modify
application data.
"""

from __future__ import annotations

import sys
import time
import unittest
from dataclasses import dataclass
from typing import Iterable, Sequence


DEFAULT_TEST_MODULES: Sequence[str] = (
    "scripts.scoring_regression",
    "scripts.model_architecture_regression",
    "scripts.score_fusion_regression",
    "tests.test_scoring_contract",
    "tests.test_validation_metrics",
)


@dataclass(frozen=True)
class RegressionSummary:
    tests_run: int
    failures: int
    errors: int
    skipped: int
    duration_seconds: float

    @property
    def successful(self) -> bool:
        return self.failures == 0 and self.errors == 0


def build_suite(
    module_names: Iterable[str] = DEFAULT_TEST_MODULES,
) -> unittest.TestSuite:
    loader = unittest.defaultTestLoader
    suite = unittest.TestSuite()

    for module_name in module_names:
        loaded = loader.loadTestsFromName(module_name)
        suite.addTests(loaded)

    return suite


def run_suite(
    module_names: Iterable[str] = DEFAULT_TEST_MODULES,
) -> RegressionSummary:
    suite = build_suite(module_names)
    started_at = time.perf_counter()

    result = unittest.TextTestRunner(
        stream=sys.stdout,
        verbosity=2,
    ).run(suite)

    duration_seconds = time.perf_counter() - started_at
    summary = RegressionSummary(
        tests_run=result.testsRun,
        failures=len(result.failures),
        errors=len(result.errors),
        skipped=len(result.skipped),
        duration_seconds=duration_seconds,
    )

    print("\nTypeTrace regression gate")
    print("-------------------------")
    print(f"Tests run : {summary.tests_run}")
    print(f"Failures  : {summary.failures}")
    print(f"Errors    : {summary.errors}")
    print(f"Skipped   : {summary.skipped}")
    print(f"Duration  : {summary.duration_seconds:.3f}s")
    print(
        "Result    : PASS"
        if summary.successful
        else "Result    : FAIL"
    )

    return summary


def main() -> int:
    summary = run_suite()
    return 0 if summary.successful else 1


if __name__ == "__main__":
    raise SystemExit(main())
