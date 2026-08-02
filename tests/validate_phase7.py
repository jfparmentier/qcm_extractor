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
    "frontend/src/domain/review.ts",
    "frontend/src/export/createZip.ts",
    "frontend/src/components/QuestionReview.tsx",
    "deployment/qcm-extractor-site/public/assets/domain/review.js",
    "deployment/qcm-extractor-site/public/assets/export/createZip.js",
    "deployment/qcm-extractor-site/public/assets/components/QuestionReview.js",
    "tests/test_review.mjs",
    "frontend/src/components/PreparationPanel.tsx",
    "backend/public/workflow-config.php",
    "deployment/qcm-extractor-site/public/api/workflow-config.php",
    "deployment/qcm-extractor-site/public/assets/components/PreparationPanel.js",
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f"Fichiers de phase 7 absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "0.13.0"
assert not (FRONTEND / "dist").exists()
assert not (FRONTEND / "node_modules").exists()

review = (FRONTEND / "src/components/QuestionReview.tsx").read_text(encoding="utf-8")
for marker in (
    "PDF de la question",
    "Contenu extrait",
    "Précédente",
    "Suivante",
    "Exporter le ZIP",
    "Propositions et réponses correctes",
    "Illustrations extraites",
    "Feedback pédagogique",
    "focusBbox={focusBbox}",
):
    assert marker in review, marker
for removed in (
    "Phase 7 · Révision",
    "Question validée",
    "Origine de la réponse correcte",
    "Non disponible</small>",
    "Question {currentIndex + 1} / {total}",
):
    assert removed not in review, removed

viewer = (FRONTEND / "src/components/PdfViewer.tsx").read_text(encoding="utf-8")
for marker in (
    '"review"',
    '"preparing"',
    "QuestionReview",
    "PreparationPanel",
    "createReviewQuestions",
    "createReviewExport",
    "createReviewArchive",
    "downloadBlob",
    "illustrationsReady",
    "extractionAllCompleted",
    "onValidateMapping",
    "window.setTimeout(onGenerateAllIllustrations, 0)",
    "automaticExtractionPendingRef",
    "onExtractAll();",
):
    assert marker in viewer, marker
assert "side-panel-tabs" not in viewer
assert "BatchPanel" not in viewer
assert "PDF en mémoire" not in viewer
for marker in ("onDeleteSegment", "finalizedQuestions", "validated: true"):
    assert marker in viewer, marker

review_domain = (FRONTEND / "src/domain/review.ts").read_text(encoding="utf-8")
for marker in (
    "reviewQuestionIssues",
    "source_sha256",
    "validation_status",
    "replaceAssetTokens",
    "assets/",
    "createReviewArchive",
    "questions.json",
    "Le feedback pédagogique est vide.",
):
    assert marker in review_domain, marker

css = (FRONTEND / "src/styles/app.css").read_text(encoding="utf-8")
for marker in (
    ".question-review__columns",
    "grid-template-columns: minmax(420px, 1fr) minmax(460px, 1fr)",
    ".question-editor-column",
    ".question-review__navigation",
):
    assert marker in css, marker

canvas_source = (FRONTEND / "src/components/PdfPageCanvas.tsx").read_text(encoding="utf-8")
assert 'type ResizeHandle = "se"' in canvas_source
assert 'const RESIZE_HANDLES: readonly ResizeHandle[] = ["se"]' in canvas_source
assert '"ne"' not in canvas_source.split("const RESIZE_HANDLES", 1)[1].split(";", 1)[0]
assert "top: auto;" in css
assert "left: auto;" in css
assert "right: -11px;" in css
assert "bottom: -11px;" in css
assert 'content: "↘";' in css

build_info = json.loads((PUBLIC / "build-info.json").read_text(encoding="utf-8"))
assert build_info["phase"] == 7
assert build_info["version"] == "7.5.1"
assert build_info["application_version"] == "0.13.0"
assert "question-by-question-review" in build_info["features"]
assert "zip-export-with-images" in build_info["features"]
assert "json-inside-zip" in build_info["features"]
assert "dependency-free-zip-writer" in build_info["features"]
assert "review-after-illustrations" in build_info["features"]
assert "mandatory-llm-feedback" in build_info["features"]
assert "sequential-single-panel-workflow" in build_info["features"]
assert "server-managed-batch-settings" in build_info["features"]
assert "automatic-batch-preparation" in build_info["features"]
assert "automatic-illustration-extraction" in build_info["features"]
for feature in (
    "mapping-question-by-question",
    "mapping-segment-deletion",
    "focused-pdf-review",
    "automatic-review-validation",
    "mandatory-generated-titles",
    "simplified-review-interface",
):
    assert feature in build_info["features"], feature
for feature in (
    "single-bottom-right-resize-handle",
    "automatic-extraction-after-mapping",
    "aggregate-extraction-progress",
    "no-individual-batch-extraction",
):
    assert feature in build_info["features"], feature

assert "cache-busted-static-modules" in build_info["features"]
assert "review-navigation-banner-removed" in build_info["features"]

mapping_panel = (FRONTEND / "src/components/MappingPanel.tsx").read_text(encoding="utf-8")
for marker in (
    "Valider les zones",
    "Supprimer ce QCM",
    "QCM {selectedIndex + 1} sur {segments.length}",
    "Précédente",
    "Suivante",
):
    assert marker in mapping_panel, marker
for removed in (
    "Le proxy démarre une tâche asynchrone",
    "Contrôles d’état",
    "segment-list",
    "<dt>Document</dt>",
    "<dt>Type</dt>",
    "<dt>Langue</dt>",
    "Une zone « Énoncé » regroupe tout le texte du QCM",
):
    assert removed not in mapping_panel, removed

extraction_panel = (FRONTEND / "src/components/ExtractionPanel.tsx").read_text(encoding="utf-8")
assert "Chaque sous-PDF est transmis au proxy sans stockage persistant" not in extraction_panel
assert "Lots simultanés" not in extraction_panel
assert "Nouvelles tentatives" not in extraction_panel
assert "Phase 5" not in extraction_panel
assert "Extraire tous les lots" not in extraction_panel
assert "Extraire ce lot" not in extraction_panel
assert "onExtractBatch" not in extraction_panel
assert "extraction-card" not in extraction_panel
for marker in (
    "Extraire les QCM",
    "Temps écoulé",
    "Lots traités",
    "Questions extraites",
    "mapping-progress",
    "formatElapsed",
):
    assert marker in extraction_panel, marker

runtime = (ROOT / "deployment/qcm-extractor-site/private/config/runtime.php").read_text(encoding="utf-8")
for marker in (
    "QCM_BATCH_MAX_QUESTIONS",
    "QCM_BATCH_MAX_PAGES",
    "QCM_BATCH_MAX_ESTIMATED_BYTES",
    "QCM_BATCH_CONTEXT_PADDING_PAGES",
    "QCM_BATCH_MAX_GAP_PAGES",
    "QCM_EXTRACTION_MAX_CONCURRENT_BATCHES",
    "QCM_EXTRACTION_MAX_RETRIES",
):
    assert marker in runtime

prompt = (ROOT / "backend/prompts/extraction.txt").read_text(encoding="utf-8")
for marker in (
    "Chaque question doit impérativement posséder un feedback.content non vide",
    "feedback.origin = generated_by_model",
    "génère systématiquement un titre court",
    "title.content et feedback.content ne doivent jamais être vides",
):
    assert marker in prompt, marker

openai_schema = json.loads((ROOT / "backend/schemas/extraction.openai.schema.json").read_text(encoding="utf-8"))
question_schema = openai_schema["properties"]["questions"]["items"]["properties"]
feedback_schema = question_schema["feedback"]
title_schema = question_schema["title"]
assert feedback_schema["properties"]["content"]["minLength"] == 1
assert "not_available" not in feedback_schema["properties"]["origin"]["enum"]
assert title_schema["properties"]["content"]["minLength"] == 1
assert "not_available" not in title_schema["properties"]["origin"]["enum"]

index = (PUBLIC / "index.html").read_text(encoding="utf-8")
assert "Phase 7" in index
assert "?v=7.5.1" in index
assert 'name="application-version" content="7.5.1"' in index

for js_file in PUBLIC.joinpath("assets").rglob("*.js"):
    subprocess.run(["node", "--check", str(js_file)], check=True, capture_output=True, text=True)
    source = js_file.read_text(encoding="utf-8")
    for relative in re.findall(r'(?:from\s+|import\s*)["\'](\.{1,2}/[^"\']+)["\']', source):
        target = (js_file.parent / relative.split("?", 1)[0]).resolve()
        assert target.is_file(), f"Import portable introuvable : {js_file.relative_to(ROOT)} -> {relative}"

subprocess.run(["node", "tests/test_review.mjs"], cwd=ROOT, check=True)
css = (PUBLIC / "assets" / "app.css").read_text(encoding="utf-8")
assert ".pdf-region > .pdf-region__handle" in css
assert "top: auto;" in css
assert "left: auto;" in css
assert "right: -11px;" in css
assert "bottom: -11px;" in css
assert 'content: "↘";' in css

print("OK phase 7.5.1 : extraction automatique et progression globale")
