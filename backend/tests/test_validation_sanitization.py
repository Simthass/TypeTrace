"""Regression tests for secret-safe validation responses."""

from __future__ import annotations

import json
import unittest

from fastapi.exceptions import RequestValidationError

from app.main import _sanitize_validation_errors


class ValidationSanitizationTests(unittest.TestCase):
    def test_sensitive_input_and_exception_context_are_removed(self) -> None:
        error = RequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "password"),
                    "msg": "Value error, rejected password SuperSecret1",
                    "input": "SuperSecret1",
                    "ctx": {"error": ValueError("SuperSecret1")},
                },
                {
                    "type": "value_error",
                    "loc": ("body", "otp"),
                    "msg": "Value error, invalid 123456",
                    "input": "123456",
                },
            ]
        )

        safe = _sanitize_validation_errors(error)
        serialized = json.dumps(safe)

        self.assertNotIn("SuperSecret1", serialized)
        self.assertNotIn("123456", serialized)
        self.assertNotIn("input", serialized)
        self.assertNotIn("ctx", serialized)
        self.assertEqual(safe[0]["message"], "Invalid value.")
        self.assertEqual(safe[1]["message"], "Invalid value.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
