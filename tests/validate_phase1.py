#!/usr/bin/env python3
from __future__ import annotations

import json
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

missing = sorted(path for path in REQUIRED_FILES if not (ROOT / path).is_file())
assert not missing, f"Fichiers requis absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["private"] is True
assert package["type"] == "module"
assert package["scripts"]["dev"] == "vite"
assert "tsc -b" in package["scripts"]["build"]
assert set(package["dependencies"]) == {"ajv", "pdf-lib", "pdfjs-dist", "react", "react-dom"}

state_source = (FRONTEND / "src/domain/projectState.ts").read_text(encoding="utf-8")
for status in ("empty", "loading", "pdf_loaded", "error"):
    assert f'"{status}"' in state_source
assert "MIN_ZOOM = 0.5" in state_source
assert "MAX_ZOOM = 2.5" in state_source

loader_source = (FRONTEND / "src/pdf/loadPdf.ts").read_text(encoding="utf-8")
assert '"%PDF-"' in loader_source
assert "MAX_PDF_SIZE_BYTES" in loader_source
assert "isEvalSupported" not in loader_source
assert "useSystemFonts: true" in loader_source

worker_source = (FRONTEND / "src/pdf/pdfWorker.ts").read_text(encoding="utf-8")
assert "GlobalWorkerOptions.workerSrc" in worker_source
assert "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs" in worker_source

source_text = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted((FRONTEND / "src").rglob("*"))
    if path.is_file() and path.suffix in {".ts", ".tsx"}
)
for forbidden in ("localStorage", "sessionStorage", "indexedDB", "document.cookie", "WebSocket"):
    assert forbidden not in source_text, f"Mécanisme de stockage ou connexion non prévu : {forbidden}"
assert "IntersectionObserver" in source_text
assert "devicePixelRatio" in source_text
assert "loadingTask.destroy()" in source_text
assert ".document.destroy()" not in source_text
assert "useKeyboardNavigation" in source_text
assert not (FRONTEND / "node_modules").exists()

print("OK socle frontend de phase 1 conservé")
