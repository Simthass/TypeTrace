#!/usr/bin/env python3
"""TypeTrace comprehensive testing and coverage runner.

Authoritative coverage outputs:
- backend/coverage-app.json
- backend/coverage-html-app/index.html
- frontend/coverage/coverage-summary.json
- frontend/coverage/index.html

The backend "runtime app" denominator deliberately excludes offline ML
training/research utilities. Those files remain compiled and are tested by
separate research-pipeline/regression gates rather than being presented as
production request-runtime coverage.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import unittest
from urllib.parse import urlparse


REQUIRED_BASELINE_TESTS = (
    "tests/__init__.py",
    "tests/helpers.py",
    "tests/test_auth_api.py",
    "tests/test_auth_redis_integration.py",
    "tests/test_crypto_privacy.py",
    "tests/test_evidence_encryption_maintenance.py",
    "tests/test_part2_evidence_integrity.py",
    "tests/test_part3_capture_closure.py",
    "tests/test_public_api_contract.py",
    "tests/test_request_body_limit.py",
    "tests/test_role_access.py",
    "tests/test_schema_config.py",
    "tests/test_scoring_contract.py",
    "tests/test_token_version.py",
    "tests/test_validation_metrics.py",
    "tests/test_validation_sanitization.py",
    "tests/test_workflow_api.py",
)

REQUIRED_PART5_TESTS = (
    "tests/test_coverage_certificate_signing.py",
    "tests/test_coverage_email.py",
    "tests/test_coverage_repositories.py",
)

SCRIPT_REGRESSIONS = (
    "scripts.scoring_regression",
    "scripts.model_architecture_regression",
    "scripts.score_fusion_regression",
)

MINIMUM_DISCOVERED_TESTS = 113
REDIS_INTEGRATION_TEST_COUNT = 5
DEFAULT_REDIS_TEST_URL = "redis://127.0.0.1:6379/15"

# Offline research/training utilities: not imported by request-time production
# runtime. They remain part of compile/research reproducibility testing.
BACKEND_RUNTIME_COVERAGE_EXCLUDES = {
    "app/ml/dataset_loader.py",
    "app/ml/train_isolation_forest.py",
    "app/ml/train_model.py",
}


def run(
    command: list[str],
    *,
    cwd: Path,
    env: dict[str, str] | None = None,
) -> None:
    print(f"> {' '.join(command)}", flush=True)
    completed = subprocess.run(
        command,
        cwd=str(cwd),
        env=env,
        check=False,
    )
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def require_file(path: Path) -> None:
    if not path.is_file():
        raise SystemExit(f"Required file is missing: {path}")


def executable(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    raise SystemExit(f"Required executable not found on PATH: {name}")


def discover_backend_count(backend: Path) -> int:
    previous = os.environ.pop("RUN_REDIS_INTEGRATION_TESTS", None)
    sys.path.insert(0, str(backend))
    try:
        suite = unittest.defaultTestLoader.discover(
            start_dir=str(backend / "tests"),
            pattern="test_*.py",
            top_level_dir=str(backend),
        )
        return suite.countTestCases()
    finally:
        try:
            sys.path.remove(str(backend))
        except ValueError:
            pass
        if previous is not None:
            os.environ["RUN_REDIS_INTEGRATION_TESTS"] = previous


def normalize_backend_coverage_name(value: str) -> str:
    text = value.replace("\\", "/")
    marker = "/app/"
    if marker in text:
        return "app/" + text.split(marker, 1)[1]
    if text.startswith("app/"):
        return text
    return text.lstrip("./")


def validate_backend_denominator(backend: Path) -> None:
    report = backend / "coverage-app.json"
    require_file(report)

    payload = json.loads(report.read_text(encoding="utf-8"))
    measured = {
        normalize_backend_coverage_name(name)
        for name in payload.get("files", {})
    }

    all_app_files = {
        path.relative_to(backend).as_posix()
        for path in (backend / "app").rglob("*.py")
        if "__pycache__" not in path.parts
    }
    expected = all_app_files - BACKEND_RUNTIME_COVERAGE_EXCLUDES

    missing = sorted(expected - measured)
    if missing:
        preview = "\n".join(f" - {name}" for name in missing[:25])
        raise SystemExit(
            "Backend runtime coverage denominator is incomplete. "
            f"{len(missing)} expected runtime Python files are absent:\n"
            f"{preview}"
        )

    wrongly_included = sorted(BACKEND_RUNTIME_COVERAGE_EXCLUDES & measured)
    if wrongly_included:
        raise SystemExit(
            "Offline ML training files unexpectedly entered the runtime "
            "coverage denominator:\n - " + "\n - ".join(wrongly_included)
        )

    totals = payload.get("totals", {})
    print(
        "Backend runtime coverage denominator validated: "
        f"{len(expected)} runtime app Python files represented; "
        f"{len(BACKEND_RUNTIME_COVERAGE_EXCLUDES)} offline training files excluded.",
        flush=True,
    )
    if totals:
        covered = totals.get(
            "percent_covered_display",
            totals.get("percent_covered", "unknown"),
        )
        print(f"Backend runtime app coverage: {covered}%", flush=True)


def normalize_frontend_coverage_name(value: str) -> str:
    text = value.replace("\\", "/")
    marker = "/src/"
    if marker in text:
        return "src/" + text.split(marker, 1)[1]
    if text.startswith("src/"):
        return text
    return text.lstrip("./")


def frontend_file_is_excluded(relative: str) -> bool:
    normalized = relative.replace("\\", "/")
    if normalized == "src/main.tsx":
        return True
    if normalized.endswith(".d.ts"):
        return True
    if ".test.ts" in normalized or ".test.tsx" in normalized:
        return True
    if normalized.startswith("src/test/"):
        return True
    if normalized.startswith("src/types/"):
        return True
    return False


def validate_frontend_denominator(frontend: Path) -> None:
    report = frontend / "coverage" / "coverage-summary.json"
    require_file(report)

    payload = json.loads(report.read_text(encoding="utf-8"))
    measured = {
        normalize_frontend_coverage_name(name)
        for name in payload
        if name != "total"
    }

    expected: set[str] = set()
    for extension in ("*.ts", "*.tsx"):
        for path in (frontend / "src").rglob(extension):
            relative = path.relative_to(frontend).as_posix()
            if not frontend_file_is_excluded(relative):
                expected.add(relative)

    missing = sorted(expected - measured)
    if missing:
        preview = "\n".join(f" - {name}" for name in missing[:40])
        raise SystemExit(
            "Frontend coverage denominator is NOT whole-source. "
            f"{len(missing)} executable production files are absent from "
            "frontend/coverage/coverage-summary.json:\n"
            f"{preview}"
        )

    total = payload.get("total", {})
    print(
        "Frontend whole-source coverage denominator validated: "
        f"{len(expected)} executable production TS/TSX files represented.",
        flush=True,
    )
    print(
        "Frontend whole-source coverage: "
        f"lines={total.get('lines', {}).get('pct', 'unknown')}% "
        f"statements={total.get('statements', {}).get('pct', 'unknown')}% "
        f"branches={total.get('branches', {}).get('pct', 'unknown')}% "
        f"functions={total.get('functions', {}).get('pct', 'unknown')}%",
        flush=True,
    )


def redis_endpoint(redis_url: str) -> tuple[str, int]:
    parsed = urlparse(redis_url)
    if parsed.scheme not in {"redis", "rediss"}:
        raise SystemExit(
            "Redis test URL must use redis:// or rediss://. "
            f"Received: {parsed.scheme or '<missing scheme>'}"
        )
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (6380 if parsed.scheme == "rediss" else 6379)
    return host, port


def assert_redis_reachable(redis_url: str) -> None:
    host, port = redis_endpoint(redis_url)
    print(
        f"Redis integration preflight: checking {host}:{port} "
        "(isolated test Redis required)...",
        flush=True,
    )
    try:
        with socket.create_connection((host, port), timeout=2):
            pass
    except OSError as exc:
        raise SystemExit(
            "\nRedis integration was explicitly required, but the configured "
            f"test Redis is not reachable at {host}:{port}.\n\n"
            "Start an ISOLATED Redis instance, then rerun the same command.\n"
            f"Recommended local test URL: {redis_url}\n"
            "Do not point these tests at production Redis.\n\n"
            f"Connection error: {exc}"
        ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-install", action="store_true")
    parser.add_argument("--run-full-browser-suite", action="store_true")
    parser.add_argument("--require-redis-integration", action="store_true")
    parser.add_argument(
        "--redis-test-url",
        default=os.environ.get("REDIS_TEST_URL", DEFAULT_REDIS_TEST_URL),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(__file__).resolve().parent
    backend = root / "backend"
    frontend = root / "frontend"

    python = backend / "venv" / "Scripts" / "python.exe"
    if os.name != "nt":
        python = backend / "venv" / "bin" / "python"

    require_file(python)
    require_file(backend / ".coveragerc")
    require_file(frontend / "vitest.config.ts")

    for rel in REQUIRED_BASELINE_TESTS + REQUIRED_PART5_TESTS:
        require_file(backend / rel)

    count = discover_backend_count(backend)
    print(f"Backend unittest discovery count: {count}", flush=True)
    if count < MINIMUM_DISCOVERED_TESTS:
        raise SystemExit(
            "Backend test baseline is incomplete: "
            f"expected at least {MINIMUM_DISCOVERED_TESTS}, found {count}."
        )

    base_env = os.environ.copy()
    base_env.pop("RUN_REDIS_INTEGRATION_TESTS", None)

    print("== Backend: deterministic tests + runtime app branch coverage ==", flush=True)
    run([str(python), "-m", "compileall", "app", "scripts", "tests"], cwd=backend, env=base_env)
    run([str(python), "-m", "coverage", "erase"], cwd=backend, env=base_env)
    run(
        [
            str(python),
            "-m",
            "coverage",
            "run",
            "--rcfile=.coveragerc",
            "-m",
            "unittest",
            "discover",
            "-s",
            "tests",
            "-v",
        ],
        cwd=backend,
        env=base_env,
    )

    print("== Backend: deterministic ML/scoring regression modules ==", flush=True)
    for module in SCRIPT_REGRESSIONS:
        run(
            [
                str(python),
                "-m",
                "coverage",
                "run",
                "--append",
                "--rcfile=.coveragerc",
                "-m",
                module,
            ],
            cwd=backend,
            env=base_env,
        )

    if args.require_redis_integration:
        assert_redis_reachable(args.redis_test_url)
        redis_env = base_env.copy()
        redis_env["RUN_REDIS_INTEGRATION_TESTS"] = "1"
        redis_env["REDIS_URL"] = args.redis_test_url

        print("== Backend: live isolated Redis integration gate ==", flush=True)
        run(
            [
                str(python),
                "-m",
                "coverage",
                "run",
                "--append",
                "--rcfile=.coveragerc",
                "-m",
                "unittest",
                "tests.test_auth_redis_integration",
                "-v",
            ],
            cwd=backend,
            env=redis_env,
        )
        print(
            f"Redis integration gate passed: {REDIS_INTEGRATION_TEST_COUNT} cases.",
            flush=True,
        )
    else:
        print(
            "Redis integration gate: DEFERRED for this coverage pass "
            "(five live cases skipped).",
            flush=True,
        )

    print("== Backend: coverage reports ==", flush=True)
    run(
        [str(python), "-m", "coverage", "report", "--rcfile=.coveragerc", "-m"],
        cwd=backend,
        env=base_env,
    )
    run(
        [
            str(python),
            "-m",
            "coverage",
            "json",
            "--rcfile=.coveragerc",
            "-o",
            "coverage-app.json",
        ],
        cwd=backend,
        env=base_env,
    )
    run(
        [
            str(python),
            "-m",
            "coverage",
            "html",
            "--rcfile=.coveragerc",
            "-d",
            "coverage-html-app",
        ],
        cwd=backend,
        env=base_env,
    )
    validate_backend_denominator(backend)

    npm = executable("npm.cmd" if os.name == "nt" else "npm")
    npx = executable("npx.cmd" if os.name == "nt" else "npx")

    print("== Frontend: whole executable-source Vitest coverage ==", flush=True)
    if not args.skip_install:
        run([npm, "ci"], cwd=frontend)

    # Never allow a stale narrow-scope report to masquerade as this run.
    coverage_dir = frontend / "coverage"
    if coverage_dir.exists():
        shutil.rmtree(coverage_dir)

    run(
        [npx, "vitest", "run", "--config", "vitest.config.ts", "--coverage"],
        cwd=frontend,
    )
    validate_frontend_denominator(frontend)

    print("== Frontend: lint and production build ==", flush=True)
    run([npm, "run", "lint"], cwd=frontend)
    run([npm, "run", "build"], cwd=frontend)

    if args.run_full_browser_suite:
        print("== Frontend: full Playwright browser suite ==", flush=True)
        run([npx, "playwright", "test"], cwd=frontend)

    print("", flush=True)
    print("Comprehensive TypeTrace testing pass completed successfully.", flush=True)
    print("Backend HTML: backend\\coverage-html-app\\index.html", flush=True)
    print("Frontend HTML: frontend\\coverage\\index.html", flush=True)
    print(
        "Redis integration: PASSED"
        if args.require_redis_integration
        else "Redis integration: DEFERRED (not final full closure)",
        flush=True,
    )
    print("No deployment was performed.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
