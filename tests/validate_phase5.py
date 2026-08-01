#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
PUBLIC = ROOT / "deployment" / "qcm-extractor-site" / "public"
PRIVATE = ROOT / "deployment" / "qcm-extractor-site" / "private"

required = {
    "frontend/src/domain/extraction.ts",
    "frontend/src/domain/extractionContext.ts",
    "frontend/src/components/ExtractionPanel.tsx",
    "frontend/src/schemas/extractionSchema.ts",
    "backend/public/extraction-status.php",
    "backend/public/extraction-cancel.php",
    "deployment/qcm-extractor-site/public/api/extraction-status.php",
    "deployment/qcm-extractor-site/public/api/extraction-cancel.php",
    "deployment/qcm-extractor-site/public/assets/domain/extraction.js",
    "deployment/qcm-extractor-site/public/assets/domain/extractionContext.js",
    "deployment/qcm-extractor-site/public/assets/components/ExtractionPanel.js",
    "deployment/qcm-extractor-site/public/assets/schemas/extractionSchema.js",
    "tests/test_extraction_context.mjs",
}
missing = sorted(path for path in required if not (ROOT / path).is_file())
assert not missing, f"Fichiers de phase 5 absents : {missing}"

package = json.loads((FRONTEND / "package.json").read_text(encoding="utf-8"))
assert package["version"] == "0.11.1"
assert not (FRONTEND / "dist").exists()
assert not (FRONTEND / "node_modules").exists()

client = (FRONTEND / "src/api/proxyClient.ts").read_text(encoding="utf-8")
for marker in (
    "extract-questions.php",
    "extraction-status.php",
    "extraction-cancel.php",
    "runBackgroundPdfJob",
    "X-QCM-Context",
):
    assert marker in client, marker

application = (ROOT / "backend/src/Application.php").read_text(encoding="utf-8")
assert "runBackgroundOperation" in application
assert "Operation $operation" in application

validator = (ROOT / "backend/src/RequestValidator.php").read_text(encoding="utf-8")
for marker in (
    "local_to_original_page_map",
    "segment_page_map",
    "contains_essential_image",
    "validateSegments",
):
    assert marker in validator, marker

prompt = (ROOT / "backend/prompts/extraction.txt").read_text(encoding="utf-8")
for marker in ("missing_segment_ids", "pages ORIGINALES", "réponse inférée"):
    assert marker in prompt, marker

state = (FRONTEND / "src/domain/projectState.ts").read_text(encoding="utf-8")
for marker in (
    "EXTRACTION_RUN_STARTED",
    "EXTRACTION_BATCH_PROGRESS",
    "EXTRACTION_BATCH_SUCCEEDED",
    "EXTRACTION_BATCH_FAILED",
):
    assert marker in state, marker

extraction = (FRONTEND / "src/domain/extraction.ts").read_text(encoding="utf-8")
for marker in (
    "validateAndNormalizeExtractionResult",
    "mergeExtractionResults",
    "missingSegmentIds",
    "duplicateSegmentIds",
    "rewriteQuestionIdentifiers",
):
    assert marker in extraction, marker

for endpoint, action in (
    ("extract-questions.php", "start"),
    ("extraction-status.php", "status"),
    ("extraction-cancel.php", "cancel"),
):
    source = (PUBLIC / "api" / endpoint).read_text(encoding="utf-8")
    assert f"qcmRunBackgroundJobEndpoint('extraction', '{action}')" in source

runtime = (PRIVATE / "config/runtime.php").read_text(encoding="utf-8")
for marker in (
    "QCM_RATE_LIMIT_EXTRACTION_REQUESTS",
    "QCM_RATE_LIMIT_LOCAL_EXTRACTION_REQUESTS",
    "QCM_OPENAI_EXTRACTION_MODEL",
):
    assert marker in runtime

def assert_ajv_strict_types(node, path="/"):
    if isinstance(node, dict):
        required_types = []
        if any(key in node for key in ("properties", "patternProperties", "required", "minProperties", "maxProperties")):
            required_types.append("object")
        if any(key in node for key in ("items", "contains", "minItems", "maxItems", "uniqueItems")):
            required_types.append("array")
        if any(key in node for key in ("minLength", "maxLength", "pattern", "format")):
            required_types.append("string")
        declared = node.get("type")
        declared_types = {declared} if isinstance(declared, str) else set(declared or [])
        for expected in required_types:
            assert expected in declared_types, f"Type {expected} absent pour un mot-clé strict à {path}"
        for key, value in node.items():
            assert_ajv_strict_types(value, f"{path.rstrip('/')}/{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            assert_ajv_strict_types(value, f"{path.rstrip('/')}/{index}")

schema = json.loads((ROOT / "schemas/extraction.schema.json").read_text(encoding="utf-8"))
assert {"missing_segment_ids", "warnings"}.issubset(schema["required"])
assert_ajv_strict_types(schema)
openai_schema = json.loads((ROOT / "backend/schemas/extraction.openai.schema.json").read_text(encoding="utf-8"))
assert {"missing_segment_ids", "warnings"}.issubset(openai_schema["required"])

build_info = json.loads((PUBLIC / "build-info.json").read_text(encoding="utf-8"))
assert build_info["phase"] >= 6
assert build_info["version"] == "7.3.1"
assert build_info["application_version"] == "0.11.1"

subprocess.run(["node", "tests/test_extraction_context.mjs"], cwd=ROOT, check=True)
print("OK phase 5 conservée : seconde passe d’extraction")
