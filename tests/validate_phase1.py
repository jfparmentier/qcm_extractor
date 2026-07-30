#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"

REQUIRED_FILES = {
    "frontend/package.json",
    "frontend/index.html",
    "frontend/vite.config.ts",
    "frontend/tsconfig.json",
    "frontend/tsconfig.app.json",
    "frontend/tsconfig.node.json",
    "frontend/src/main.tsx",
    "frontend/src/App.tsx",
    "frontend/src/domain/projectState.ts",
    "frontend/src/pdf/loadPdf.ts",
    "frontend/src/pdf/pdfWorker.ts",
    "frontend/src/components/FileDropZone.tsx",
    "frontend/src/components/PdfViewer.tsx",
    "frontend/src/components/PdfPageCanvas.tsx",
    "frontend/src/components/PdfThumbnail.tsx",
    "frontend/src/components/PdfToolbar.tsx",
    "frontend/src/styles/app.css",
    "frontend/README.md",
}

FORBIDDEN_SOURCE_PATTERNS = {
    r"\blocalStorage\b": "stockage localStorage",
    r"\bsessionStorage\b": "stockage sessionStorage",
    r"\bindexedDB\b": "stockage IndexedDB",
    r"document\.cookie": "cookie applicatif",
    r"\bfetch\s*\(": "appel fetch",
    r"\bXMLHttpRequest\b": "appel XMLHttpRequest",
    r"\bWebSocket\b": "connexion WebSocket",
    r"\baxios\b": "client HTTP axios",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


missing = sorted(path for path in REQUIRED_FILES if not (ROOT / path).is_file())
assert not missing, f"Fichiers requis absents : {missing}"

package = read_json(FRONTEND / "package.json")
assert package["private"] is True
assert package["type"] == "module"
assert package["scripts"]["dev"] == "vite"
assert "tsc -b" in package["scripts"]["build"]
assert set(package["dependencies"]) == {"pdfjs-dist", "react", "react-dom"}
assert {"typescript", "vite", "@types/react", "@types/react-dom"}.issubset(
    package["devDependencies"]
)

state_source = (FRONTEND / "src/domain/projectState.ts").read_text(encoding="utf-8")
for status in ("empty", "loading", "pdf_loaded", "error"):
    assert f'"{status}"' in state_source, f"État absent : {status}"
assert "MIN_ZOOM = 0.5" in state_source
assert "MAX_ZOOM = 2.5" in state_source

loader_source = (FRONTEND / "src/pdf/loadPdf.ts").read_text(encoding="utf-8")
assert '"%PDF-"' in loader_source
assert "MAX_PDF_SIZE_BYTES" in loader_source
assert "isEvalSupported: false" in loader_source

worker_source = (FRONTEND / "src/pdf/pdfWorker.ts").read_text(encoding="utf-8")
assert "GlobalWorkerOptions.workerSrc" in worker_source
assert "pdf.worker.min.mjs?url" in worker_source

source_files = sorted((FRONTEND / "src").rglob("*"))
source_text = "\n".join(
    path.read_text(encoding="utf-8")
    for path in source_files
    if path.is_file() and path.suffix in {".ts", ".tsx"}
)
for pattern, description in FORBIDDEN_SOURCE_PATTERNS.items():
    assert re.search(pattern, source_text) is None, f"Mécanisme interdit détecté : {description}"

assert "IntersectionObserver" in source_text, "Chargement paresseux des miniatures absent."
assert "devicePixelRatio" in source_text, "Rendu haute densité absent."
assert ".destroy()" in source_text, "Libération explicite du PDF absente."
assert "useKeyboardNavigation" in source_text, "Navigation clavier absente."

manifest = read_json(ROOT / "manifest.json")
assert manifest["artifact"] == "phase1_qcm_extractor"
assert manifest["version"] == "1.1.0"
assert manifest["phase"] == 1

manifest_paths = set()
for entry in manifest["generated_files"]:
    relative = entry["path"]
    path = ROOT / relative
    assert relative not in manifest_paths, f"Entrée dupliquée dans le manifeste : {relative}"
    manifest_paths.add(relative)
    assert path.is_file(), f"Fichier du manifeste absent : {relative}"
    assert path.stat().st_size == entry["bytes"], f"Taille incorrecte : {relative}"
    assert sha256(path) == entry["sha256"], f"Empreinte incorrecte : {relative}"

for required in REQUIRED_FILES:
    assert required in manifest_paths, f"Fichier requis absent du manifeste : {required}"

assert not (FRONTEND / "node_modules").exists(), "node_modules ne doit pas être inclus dans l’archive."
assert not (FRONTEND / "dist").exists(), "Le répertoire dist ne doit pas être inclus dans l’archive source."

print("OK phase 1 : structure, sécurité locale et manifeste")
