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
    "frontend/src/domain/illustration.ts",
    "frontend/src/pdf/extractIllustrations.ts",
    "frontend/src/components/IllustrationPanel.tsx",
    "deployment/qcm-extractor-site/public/assets/domain/illustration.js",
    "deployment/qcm-extractor-site/public/assets/pdf/extractIllustrations.js",
    "deployment/qcm-extractor-site/public/assets/components/IllustrationPanel.js",
    "tests/test_illustration_plan.mjs",
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f"Fichiers de phase 6 absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "0.9.0"
assert not (FRONTEND / "dist").exists()
assert not (FRONTEND / "node_modules").exists()

plan = (FRONTEND / "src/domain/illustration.ts").read_text(encoding="utf-8")
for marker in (
    "createIllustrationPlan",
    "essential_image",
    "decorative_image",
    "region.bbox",
    "insertionToken",
    "statementContainsToken",
    "revokeIllustrationAssets",
):
    assert marker in plan, marker

cropper = (FRONTEND / "src/pdf/extractIllustrations.ts").read_text(encoding="utf-8")
for marker in (
    "TARGET_PAGE_WIDTH_PX = 2400",
    "MAX_PAGE_PIXELS = 18_000_000",
    "generateIllustrationAssets",
    "canvas.toBlob",
    '"image/png"',
    "sourceCanvas.width",
    "sourceCanvas.height",
    "byPage",
):
    assert marker in cropper, marker

panel = (FRONTEND / "src/components/IllustrationPanel.tsx").read_text(encoding="utf-8")
for marker in (
    "Produire les illustrations",
    "Générer toutes les images",
    "Télécharger",
    "zones d’image déjà définies",
    "Texte alternatif",
):
    assert marker in panel, marker
for forbidden in (
    'type="file"',
    "Remplacer par un fichier",
    "Retoucher",
    "Redimensionner la zone",
):
    assert forbidden not in panel, f"Contrôle interdit dans l’onglet Images : {forbidden}"

viewer = (FRONTEND / "src/components/PdfViewer.tsx").read_text(encoding="utf-8")
for marker in ('"illustrations"', "IllustrationPanel", "onGenerateAllIllustrations", "<ImageIcon /> Images"):
    assert marker in viewer, marker

app = (FRONTEND / "src/App.tsx").read_text(encoding="utf-8")
for marker in (
    "createIllustrationPlan",
    "generateIllustrationAssets",
    "runIllustrationGeneration",
    "downloadIllustration",
    "resetIllustrations",
):
    assert marker in app, marker

build_info = json.loads((PUBLIC / "build-info.json").read_text(encoding="utf-8"))
assert build_info["phase"] >= 6
assert build_info["version"] == "7.1.0"
assert build_info["application_version"] == "0.9.0"
assert "local-illustration-cropping" in build_info["features"]

index = (PUBLIC / "index.html").read_text(encoding="utf-8")
assert "Phase 7" in index

for js_file in PUBLIC.joinpath("assets").rglob("*.js"):
    subprocess.run(["node", "--check", str(js_file)], check=True, capture_output=True, text=True)
    source = js_file.read_text(encoding="utf-8")
    for relative in re.findall(r'(?:from\s+|import\s*)["\'](\.{1,2}/[^"\']+)["\']', source):
        target = (js_file.parent / relative).resolve()
        assert target.is_file(), f"Import portable introuvable : {js_file.relative_to(ROOT)} -> {relative}"

subprocess.run(["node", "tests/test_illustration_plan.mjs"], cwd=ROOT, check=True)
print("OK phase 6.0.0 : génération locale des illustrations")
