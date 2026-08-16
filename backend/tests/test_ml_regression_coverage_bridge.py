"""Run existing deterministic ML regression contracts inside coverage collection.

The repository quality runner already executes these regression modules as a
separate deterministic gate.  Runtime application coverage is collected later
with ``unittest discover`` over ``backend/tests`` only.  This loader bridges the
same production-grade regression contracts into that measured process without
duplicating their logic or changing the coverage configuration.
"""

from __future__ import annotations

import unittest

from scripts import (
    model_architecture_regression,
    score_fusion_regression,
    scoring_regression,
)


REGRESSION_MODULES = (
    scoring_regression,
    model_architecture_regression,
    score_fusion_regression,
)


def load_tests(
    loader: unittest.TestLoader,
    tests: unittest.TestSuite,
    pattern: str | None,
) -> unittest.TestSuite:
    del tests, pattern

    suite = unittest.TestSuite()
    for module in REGRESSION_MODULES:
        suite.addTests(loader.loadTestsFromModule(module))
    return suite


if __name__ == "__main__":
    unittest.main(verbosity=2)
