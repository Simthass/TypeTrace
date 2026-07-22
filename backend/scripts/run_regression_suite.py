"""Run all deterministic TypeTrace regression and automated contract tests.

Run from the backend directory:

    python -m scripts.run_regression_suite

The runner keeps the three renamed deterministic ML regression modules and
automatically discovers every ``tests/test_*.py`` module. It does not train
a model or intentionally modify application data.
"""

from __future__ import annotations

import sys
import time
import unittest
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


SCRIPT_TEST_MODULES: Sequence[str] = (
    "scripts.scoring_regression",
    "scripts.model_architecture_regression",
    "scripts.score_fusion_regression",
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
    script_modules: Iterable[str] = SCRIPT_TEST_MODULES,
) -> unittest.TestSuite:
    loader = unittest.defaultTestLoader
    suite = unittest.TestSuite()

    for module_name in script_modules:
        suite.addTests(loader.loadTestsFromName(module_name))

    backend_dir = Path(__file__).resolve().parents[1]
    discovered = loader.discover(
        start_dir=str(backend_dir / "tests"),
        pattern="test_*.py",
        top_level_dir=str(backend_dir),
    )
    suite.addTests(discovered)
    return suite


def run_suite() -> RegressionSummary:
    suite = build_suite()
    started_at = time.perf_counter()

    result = unittest.TextTestRunner(
        stream=sys.stdout,
        verbosity=2,
    ).run(suite)

    summary = RegressionSummary(
        tests_run=result.testsRun,
        failures=len(result.failures),
        errors=len(result.errors),
        skipped=len(result.skipped),
        duration_seconds=time.perf_counter() - started_at,
    )

    print("\nTypeTrace quality gate")
    print("----------------------")
    print(f"Tests run : {summary.tests_run}")
    print(f"Failures  : {summary.failures}")
    print(f"Errors    : {summary.errors}")
    print(f"Skipped   : {summary.skipped}")
    print(f"Duration  : {summary.duration_seconds:.3f}s")
    print("Result    : PASS" if summary.successful else "Result    : FAIL")

    return summary


def main() -> int:
    return 0 if run_suite().successful else 1


if __name__ == "__main__":
    raise SystemExit(main())
