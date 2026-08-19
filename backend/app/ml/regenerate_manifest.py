"""
Regenerate backend/app/ml/artifacts/artifact_manifest.json from the artifact
files currently on disk, without retraining the model.

Run this any time an artifact file's bytes change (e.g. after fixing line
endings) so the manifest's recorded SHA-256 hashes match reality again.

Usage:
    python backend/app/ml/regenerate_manifest.py
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
MANIFEST_PATH = ARTIFACT_DIR / "artifact_manifest.json"

# Must match the "files" entries produced by train_isolation_forest.py /
# checked by inference_engine.py's _validate_manifest.
PRIMARY_ARTIFACT_FILENAMES = (
    "isolation_forest.joblib",
    "scaler.joblib",
    "feature_schema.json",
    "metrics.json",
    "model_card.json",
)


def _sha256_of(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _atomic_json_dump(payload: dict, path: Path) -> None:
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
        handle.write("\n")
    tmp_path.replace(path)


def main() -> None:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(
            f"Existing manifest not found at {MANIFEST_PATH}. This script "
            "updates an existing manifest's file hashes; it does not "
            "invent model metadata from scratch."
        )

    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        old_manifest = json.load(handle)

    files: dict[str, dict] = {}
    for filename in PRIMARY_ARTIFACT_FILENAMES:
        file_path = ARTIFACT_DIR / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Cannot regenerate manifest; missing {file_path}.")
        files[filename] = {
            "sha256": _sha256_of(file_path),
            "size_bytes": file_path.stat().st_size,
        }

    new_manifest = {
        "manifest_version": old_manifest.get("manifest_version", 1),
        "model_name": old_manifest["model_name"],
        "model_version": old_manifest["model_version"],
        "feature_schema_version": old_manifest["feature_schema_version"],
        "feature_family": old_manifest["feature_family"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }

    _atomic_json_dump(new_manifest, MANIFEST_PATH)

    print(f"Wrote updated manifest to {MANIFEST_PATH}\n")
    for filename, record in files.items():
        print(f"  {filename}: {record['sha256']}  ({record['size_bytes']} bytes)")


if __name__ == "__main__":
    main()