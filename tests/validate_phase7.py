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
    "frontend/src/components/QuestionReview.tsx",
    "deployment/qcm-extractor-site/public/assets/domain/review.js",
    "deployment/qcm-extractor-site/public/assets/components/QuestionReview.js",
    "tests/test_review.mjs",
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f"Fichiers de phase 7 absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "0.9.0"
assert not (FRONTEND / "dist").exists()
assert not (FRONTEND / "node_modules").exists()

review = (FRONTEND / "src/components/QuestionReview.tsx").read_text(encoding="utf-8")
for marker in (
    "Question {currentIndex + 1} sur {total}",
    "PDF de la question",
    "Contenu extrait",
    "Précédente",
    "Suivante",
    "Exporter le JSON",
    "Question validée",
    "Propositions et réponses correctes",
):
    assert marker in review, marker

viewer = (FRONTEND / "src/components/PdfViewer.tsx").read_text(encoding="utf-8")
for marker in (
    '"review"',
    "QuestionReview",
    "createReviewQuestions",
    "createReviewExport",
    "downloadJson",
    "<CheckIcon /> Révision",
):
    assert marker in viewer, marker

review_domain = (FRONTEND / "src/domain/review.ts").read_text(encoding="utf-8")
for marker in (
    "reviewQuestionIssues",
    "source_sha256",
    "validation_status",
    "replaceAssetTokens",
    "assets/",
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
assert build_info["version"] == "7.0.0"
assert build_info["application_version"] == "0.9.0"
assert "question-by-question-review" in build_info["features"]
assert "json-export" in build_info["features"]

index = (PUBLIC / "index.html").read_text(encoding="utf-8")
assert "Phase 7" in index

for js_file in PUBLIC.joinpath("assets").rglob("*.js"):
    subprocess.run(["node", "--check", str(js_file)], check=True, capture_output=True, text=True)
    source = js_file.read_text(encoding="utf-8")
    for relative in re.findall(r'(?:from\s+|import\s*)["\'](\.{1,2}/[^"\']+)["\']', source):
        target = (js_file.parent / relative).resolve()
        assert target.is_file(), f"Import portable introuvable : {js_file.relative_to(ROOT)} -> {relative}"

subprocess.run(["node", "tests/test_review.mjs"], cwd=ROOT, check=True)
print("OK phase 7.0.0 : éditeur question par question et export JSON")
