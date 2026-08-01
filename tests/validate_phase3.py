#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
PUBLIC = ROOT / "deployment" / "qcm-extractor-site" / "public"

required = {
    "frontend/src/domain/documentMap.ts",
    "frontend/src/schemas/mappingSchema.ts",
    "frontend/src/components/MappingPanel.tsx",
    "frontend/src/components/PdfPageCanvas.tsx",
    "frontend/src/components/PdfViewer.tsx",
    "frontend/src/api/proxyClient.ts",
    "tests/validate_phase3.py",
    "deployment/qcm-extractor-site/public/assets/components/MappingPanel.js",
    "deployment/qcm-extractor-site/public/assets/domain/documentMap.js",
    "deployment/qcm-extractor-site/public/assets/schemas/mappingSchema.js",
    "deployment/qcm-extractor-site/public/api/diagnostic.php",
    "backend/src/BackgroundJobToken.php",
    "backend/src/BackgroundResponseState.php",
    "deployment/qcm-extractor-site/public/api/mapping-status.php",
    "deployment/qcm-extractor-site/public/api/mapping-cancel.php",
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f"Fichiers phase 3 absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "0.11.1"
assert package["dependencies"]["ajv"] == "8.17.1"
assert not (FRONTEND / "dist").exists(), "La livraison ne doit pas ajouter frontend/dist."
assert not (FRONTEND / "node_modules").exists(), "node_modules ne doit pas être livré."

app = (FRONTEND / "src/App.tsx").read_text(encoding="utf-8")
for marker in (
    "analyzeDocumentMap<unknown>",
    "validateAndNormalizeDocumentMap",
    "AbortController",
    'type: "MAPPING_STARTED"',
    'type: "MAPPING_SUCCEEDED"',
    'type: "MAPPING_FAILED"',
    'type: "MAPPING_PROGRESS"',
):
    assert marker in app, f"Intégration de cartographie absente : {marker}"

state = (FRONTEND / "src/domain/projectState.ts").read_text(encoding="utf-8")
for status in ("idle", "running", "completed", "failed"):
    assert f'"{status}"' in state
assert "selectedSegmentId" in state
assert "progress" in state
assert "MAPPING_PROGRESS" in state
for marker in ("selectedRegionId", "UPDATE_REGION_BBOX", "UPDATE_REGION_ROLE", "ADD_REGION", "DELETE_REGION", "DELETE_SEGMENT"):
    assert marker in state, f"Action d’édition géométrique absente : {marker}"

mapping = (FRONTEND / "src/domain/documentMap.ts").read_text(encoding="utf-8")
for marker in (
    'from "ajv/dist/2020"',
    "validateAndNormalizeDocumentMap",
    "DocumentMapValidationError",
    "dupliqués",
    "detectStrongOverlaps",
    "x + bbox.width",
):
    assert marker in mapping, f"Validation de cartographie incomplète : {marker}"

panel = (FRONTEND / "src/components/MappingPanel.tsx").read_text(encoding="utf-8")
for marker in ("Cartographie du document", "Relancer", "Temps écoulé", "Jetons", "Éditeur de zones", "Tracer", "Rôle de la zone sélectionnée", "Supprimer ce QCM"):
    assert marker in panel

canvas = (FRONTEND / "src/components/PdfPageCanvas.tsx").read_text(encoding="utf-8")
assert "PdfOverlayRegion" in canvas
assert "pdf-region-layer" in canvas
assert "onOverlaySelect" in canvas
for marker in ("onRegionChange", "onRegionAdd", "RESIZE_HANDLES", "pointermove", "pdf-region__handle"):
    assert marker in canvas, f"Interaction géométrique absente : {marker}"

viewer = (FRONTEND / "src/components/PdfViewer.tsx").read_text(encoding="utf-8")
assert "PdfThumbnail" not in viewer
assert "thumbnail-sidebar" not in viewer
for marker in ("drawingRole", "onAddRegion", "onDeleteRegion", "onDeleteSegment", "onUpdateRegionBbox", "Delete"):
    assert marker in viewer, f"Commande de zone absente : {marker}"
portable_viewer = (PUBLIC / "assets/components/PdfViewer.js").read_text(encoding="utf-8")
assert "PdfThumbnail" not in portable_viewer
assert "thumbnail-sidebar" not in portable_viewer
portable_css = (PUBLIC / "assets/app.css").read_text(encoding="utf-8")
assert "grid-template-columns: minmax(0, 1fr) minmax(300px, 356px);" in portable_css
for marker in (".region-editor", ".pdf-region__handle", ".pdf-region-layer--drawing", ".button--danger"):
    assert marker in portable_css, f"Style d’édition absent : {marker}"

client = (FRONTEND / "src/api/proxyClient.ts").read_text(encoding="utf-8")
assert "PROXY_UNREACHABLE" in client
assert "AbortError" in client
assert 'credentials: "omit"' in client
assert "OPENAI_API_KEY" not in client
assert "response.text()" in client
assert "getProxyDiagnosticUrl" in client
assert "technicalDetails" in client
for marker in ("mapping-status.php", "mapping-cancel.php", "X-QCM-Job", "poll_after_ms", "BACKGROUND_JOB_EXPIRED"):
    assert marker in client, f"Suivi asynchrone absent : {marker}"
assert "?job=" not in client, "Le jeton de suivi ne doit pas apparaître dans l’URL."

application = (ROOT / "backend/src/Application.php").read_text(encoding="utf-8")
for marker in (
    "configureExecutionLimit",
    "registerFatalHandler",
    "PHP_EXECUTION_TIMEOUT",
    "discardBufferedOutput",
    "display_errors",
    "PHP_TIME_LIMIT_TOO_LOW",
    "Diagnostics::write",
    "runBackgroundOperation",
    "background_job_started",
    "background_job_completed",
):
    assert marker in application, f"Protection PHP absente : {marker}"

config_php = (ROOT / "backend/src/Config.php").read_text(encoding="utf-8")
assert "QCM_PHP_MAX_EXECUTION_SECONDS" in config_php
assert "doit être supérieur à QCM_REQUEST_TIMEOUT_SECONDS" in config_php
assert "gpt-5-mini" in config_php
assert "QCM_MAPPING_REASONING_EFFORT" in config_php
for marker in ("QCM_BACKGROUND_START_TIMEOUT_SECONDS", "QCM_BACKGROUND_POLL_TIMEOUT_SECONDS", "QCM_BACKGROUND_POLL_INTERVAL_MS", "QCM_BACKGROUND_JOB_TTL_SECONDS"):
    assert marker in config_php

index = (PUBLIC / "index.html").read_text(encoding="utf-8")
assert "Phase 7" in index
assert '"ajv/dist/2020"' in index
assert "./assets/main.js" in index

# Toutes les importations relatives du frontend portable doivent cibler un fichier existant.
for js_file in PUBLIC.joinpath("assets").rglob("*.js"):
    source = js_file.read_text(encoding="utf-8")
    for relative in re.findall(r'(?:from\s+|import\s*)["\'](\.{1,2}/[^"\']+)["\']', source):
        target = (js_file.parent / relative.split("?", 1)[0]).resolve()
        assert target.is_file(), f"Import portable introuvable : {js_file.relative_to(ROOT)} -> {relative}"

build_info = json.loads((PUBLIC / "build-info.json").read_text(encoding="utf-8"))
assert build_info["version"] == "7.3.1"
assert build_info["application_version"] == "0.11.1"
assert build_info["dependencies"]["ajv"] == "8.17.1"

print("OK phase 3 : cartographie et éditeur géométrique préservés")
