#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
PUBLIC = ROOT / "deployment" / "qcm-extractor-site" / "public"

required = {
    "frontend/src/domain/batchPlan.ts",
    "frontend/src/pdf/createSubPdf.ts",
    "frontend/src/components/BatchPanel.tsx",
    "deployment/qcm-extractor-site/public/assets/domain/batchPlan.js",
    "deployment/qcm-extractor-site/public/assets/pdf/createSubPdf.js",
    "deployment/qcm-extractor-site/public/assets/components/BatchPanel.js",
    "tests/test_batch_plan.mjs",
    "tests/validate_phase4.py",
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f"Fichiers phase 4 absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "0.9.1"
assert package["dependencies"]["pdf-lib"] == "1.17.1"
assert not (FRONTEND / "dist").exists(), "La livraison ne doit pas ajouter frontend/dist."
assert not (FRONTEND / "node_modules").exists(), "node_modules ne doit pas être livré."

batch_plan = (FRONTEND / "src/domain/batchPlan.ts").read_text(encoding="utf-8")
for marker in (
    "createBatchPlan",
    "maxQuestionsPerBatch",
    "maxPagesPerBatch",
    "maxEstimatedBytes",
    "contextPaddingPages",
    "maxGapPages",
    "pageMap",
    "segmentReferences",
    "duplicatedContextPages",
    "oversized",
):
    assert marker in batch_plan, f"Planification incomplète : {marker}"

subpdf = (FRONTEND / "src/pdf/createSubPdf.ts").read_text(encoding="utf-8")
for marker in (
    'from "pdf-lib"',
    "PDFDocument.load",
    "PDFDocument.create",
    "copyPages",
    "addPage",
    "useObjectStreams",
):
    assert marker in subpdf, f"Découpage PDF absent : {marker}"

state = (FRONTEND / "src/domain/projectState.ts").read_text(encoding="utf-8")
for marker in (
    "BatchPreparationState",
    "BATCH_SETTINGS_UPDATED",
    "BATCHES_PLANNED",
    "BATCH_GENERATION_STARTED",
    "BATCH_GENERATED",
    "BATCH_GENERATION_FAILED",
    "BATCHES_CLEARED",
):
    assert marker in state, f"État des lots incomplet : {marker}"

app = (FRONTEND / "src/App.tsx").read_text(encoding="utf-8")
for marker in (
    "createBatchPlan",
    "createSubPdf",
    "generateAllPlannedBatches",
    "downloadBatch",
    "BATCH_GENERATION_FAILED",
):
    assert marker in app, f"Intégration des lots absente : {marker}"

panel = (FRONTEND / "src/components/BatchPanel.tsx").read_text(encoding="utf-8")
for marker in (
    "Préparer les sous-PDF",
    "Questions par lot",
    "Pages par lot",
    "Contexte autour des pages",
    "Correspondance des pages",
    "Générer les",
    "Télécharger",
):
    assert marker in panel, f"Interface de lot absente : {marker}"

viewer = (FRONTEND / "src/components/PdfViewer.tsx").read_text(encoding="utf-8")
for marker in ("side-panel-tabs", '"batches"', "BatchPanel", "onGenerateAllBatches"):
    assert marker in viewer, f"Onglet de lots absent : {marker}"

index = (PUBLIC / "index.html").read_text(encoding="utf-8")
assert "Phase 7" in index
assert '"pdf-lib"' in index and "pdf-lib@1.17.1" in index

portable_css = (PUBLIC / "assets/app.css").read_text(encoding="utf-8")
for marker in (".side-panel-tabs", ".batch-settings", ".batch-card", ".batch-page-map"):
    assert marker in portable_css, f"Style phase 4 absent : {marker}"

for js_file in PUBLIC.joinpath("assets").rglob("*.js"):
    source = js_file.read_text(encoding="utf-8")
    for relative in re.findall(r'(?:from\s+|import\s*)["\'](\.{1,2}/[^"\']+)["\']', source):
        target = (js_file.parent / relative).resolve()
        assert target.is_file(), f"Import portable introuvable : {js_file.relative_to(ROOT)} -> {relative}"

build_info = json.loads((PUBLIC / "build-info.json").read_text(encoding="utf-8"))
assert build_info["version"] == "7.1.1"
assert build_info["application_version"] == "0.9.1"
assert build_info["dependencies"]["pdf_lib"] == "1.17.1"

subprocess.run(
    ["node", str(ROOT / "tests/test_batch_plan.mjs")],
    cwd=ROOT,
    check=True,
    text=True,
)

print("OK phase 4 conservée : découpage local et gestion des lots")
