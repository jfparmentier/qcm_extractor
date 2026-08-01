#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "manifest.json"
IGNORED_PARTS = {"node_modules", "__pycache__", ".git", "dist"}
IGNORED_NAMES = {"manifest.json"}


def included(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return (
        path.is_file()
        and path.name not in IGNORED_NAMES
        and not any(part in IGNORED_PARTS for part in relative.parts)
        and path.suffix != ".zip"
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


files = sorted(path for path in ROOT.rglob("*") if included(path))
manifest = {
    "artifact": "phase7_qcm_extractor",
    "version": "7.3.1",
    "phase": 7,
    "generated_files": [
        {
            "path": path.relative_to(ROOT).as_posix(),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        }
        for path in files
    ],
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Manifeste généré : {len(files)} fichiers")
