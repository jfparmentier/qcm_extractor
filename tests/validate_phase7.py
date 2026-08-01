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
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f"Fichiers de phase 7 absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "0.9.1"
assert not (FRONTEND / "dist").exists()
assert not (FRONTEND / "node_modules").exists()

review = (FRONTEND / "src/components/QuestionReview.tsx").read_text(encoding="utf-8")
for marker in (
    "Question {currentIndex + 1} sur {total}",
    "PDF de la question",
    "Contenu extrait",
    "Précédente",
    "Suivante",
    "Exporter le ZIP",
    "Question validée",
    "Propositions et réponses correctes",
    "Illustrations extraites",
    "Feedback pédagogique",
):
    assert marker in review, marker

viewer = (FRONTEND / "src/components/PdfViewer.tsx").read_text(encoding="utf-8")
for marker in (
    '"review"',
    "QuestionReview",
    "createReviewQuestions",
    "createReviewExport",
    "createReviewArchive",
    "downloadBlob",
    "<CheckIcon /> Révision",
    "illustrationsReady",
    "missingIllustrationCount",
    'setActivePanel(illustrationPlan.candidates.length > 0 ? "illustrations" : "review")',
):
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

build_info = json.loads((PUBLIC / "build-info.json").read_text(encoding="utf-8"))
assert build_info["phase"] == 7
assert build_info["version"] == "7.1.1"
assert build_info["application_version"] == "0.9.1"
assert "question-by-question-review" in build_info["features"]
assert "zip-export-with-images" in build_info["features"]
assert "json-inside-zip" in build_info["features"]
assert "dependency-free-zip-writer" in build_info["features"]
assert "review-after-illustrations" in build_info["features"]
assert "mandatory-llm-feedback" in build_info["features"]

prompt = (ROOT / "backend/prompts/extraction.txt").read_text(encoding="utf-8")
for marker in (
    "Chaque question doit impérativement posséder un feedback.content non vide",
    "feedback.origin = generated_by_model",
    "feedback.origin ne doit jamais valoir not_available",
):
    assert marker in prompt, marker

openai_schema = json.loads((ROOT / "backend/schemas/extraction.openai.schema.json").read_text(encoding="utf-8"))
feedback_schema = openai_schema["properties"]["questions"]["items"]["properties"]["feedback"]
assert feedback_schema["properties"]["content"]["minLength"] == 1
assert "not_available" not in feedback_schema["properties"]["origin"]["enum"]

index = (PUBLIC / "index.html").read_text(encoding="utf-8")
assert "Phase 7" in index

for js_file in PUBLIC.joinpath("assets").rglob("*.js"):
    subprocess.run(["node", "--check", str(js_file)], check=True, capture_output=True, text=True)
    source = js_file.read_text(encoding="utf-8")
    for relative in re.findall(r'(?:from\s+|import\s*)["\'](\.{1,2}/[^"\']+)["\']', source):
        target = (js_file.parent / relative).resolve()
        assert target.is_file(), f"Import portable introuvable : {js_file.relative_to(ROOT)} -> {relative}"

subprocess.run(["node", "tests/test_review.mjs"], cwd=ROOT, check=True)
print("OK phase 7.1.1 : éditeur question par question et export ZIP avec images")
