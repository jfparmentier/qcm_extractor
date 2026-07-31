#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

REQUIRED_FILES = {
    "backend/public/analyze-map.php",
    "backend/public/extract-questions.php",
    "backend/public/index.php",
    "backend/src/Application.php",
    "backend/src/Config.php",
    "backend/src/ClientAddress.php",
    "backend/src/RequestValidator.php",
    "backend/src/OpenAiResponsesClient.php",
    "backend/src/OpenAiPayloadFactory.php",
    "backend/src/OpenAiResponseParser.php",
    "backend/src/OriginPolicy.php",
    "backend/src/RateLimiter.php",
    "backend/prompts/mapping.txt",
    "backend/prompts/extraction.txt",
    "backend/schemas/mapping.openai.schema.json",
    "backend/schemas/extraction.openai.schema.json",
    "backend/config/environment.example",
    "backend/config/php.ini.example",
    "backend/README.md",
    "backend/tests/run.php",
    "frontend/src/api/proxyClient.ts",
    "frontend/.env.example",
    "tests/validate_phase2.py",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def assert_strict_schema(node, location="$"):
    if isinstance(node, dict):
        if node.get("type") == "object":
            assert node.get("additionalProperties") is False, f"additionalProperties manquant : {location}"
            properties = node.get("properties", {})
            assert set(node.get("required", [])) == set(properties), f"Toutes les propriétés doivent être requises : {location}"
        forbidden = {"allOf", "if", "then", "else", "pattern", "uniqueItems", "const", "$schema", "$id"}
        assert not (forbidden & set(node)), f"Mot-clé non retenu pour Structured Outputs à {location}: {forbidden & set(node)}"
        for key, value in node.items():
            assert_strict_schema(value, f"{location}/{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            assert_strict_schema(value, f"{location}/{index}")


missing = sorted(path for path in REQUIRED_FILES if not (ROOT / path).is_file())
assert not missing, f"Fichiers requis absents : {missing}"
assert not (FRONTEND / "dist").exists(), "La phase 2 ne doit pas inclure de version déployable."
assert not (FRONTEND / "node_modules").exists(), "node_modules ne doit pas être inclus."

php_sources = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted((BACKEND / "src").rglob("*.php"))
) + "\n" + "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted((BACKEND / "public").rglob("*.php"))
)
assert "https://api.openai.com/v1/responses" in php_sources
assert "/v1/files" not in php_sources, "Le proxy ne doit pas créer de fichier persistant chez le fournisseur."
assert "'store' => false" in php_sources
assert "php://input" in php_sources
assert "move_uploaded_file" not in php_sources
assert "$_FILES" not in php_sources
assert "CURLOPT_SSL_VERIFYPEER" in php_sources
assert "CURLOPT_FOLLOWLOCATION => false" in php_sources
assert "GlobalWorkerOptions" not in php_sources
assert "OPENAI_API_KEY" in php_sources
assert "QCM_OPENAI_MAPPING_MODEL" in php_sources
assert "QCM_OPENAI_EXTRACTION_MODEL" in php_sources
assert "X-QCM-Context" in php_sources or "HTTP_X_QCM_CONTEXT" in php_sources
assert "apcu_" in php_sources
assert "QCM_TRUSTED_PROXY_ADDRESSES" in php_sources
assert "Content-Security-Policy" in php_sources
assert "error_log" in php_sources

# La clé d’exemple doit être manifestement fictive et aucune clé réelle ne doit être incluse.
all_text = "\n".join(
    path.read_text(encoding="utf-8", errors="ignore")
    for path in ROOT.rglob("*")
    if path.is_file() and path.suffix.lower() not in {".pdf", ".zip"}
)
for match in re.findall(r"sk-[A-Za-z0-9_-]{20,}", all_text):
    assert "remplacer" in match or "never" in match, f"Clé API potentielle incluse : {match[:12]}..."

for schema_name in ("mapping.openai.schema.json", "extraction.openai.schema.json"):
    schema = read_json(BACKEND / "schemas" / schema_name)
    assert_strict_schema(schema)

client = (FRONTEND / "src/api/proxyClient.ts").read_text(encoding="utf-8")
assert '"Content-Type": "application/pdf"' in client
assert 'credentials: "omit"' in client
assert 'cache: "no-store"' in client
assert 'redirect: "error"' in client
assert "OPENAI_API_KEY" not in client
send_pdf_block = client.split("async function sendPdf", 1)[1].split("export function analyzeDocumentMap", 1)[0]
assert "model:" not in send_pdf_block and "\"model\"" not in send_pdf_block, "Le client ne doit pas choisir le modèle."

package = read_json(FRONTEND / "package.json")
assert package["version"] == "0.2.0"
assert "build:portable" not in package["scripts"]

manifest = read_json(ROOT / "manifest.json")
assert manifest["artifact"] == "phase2_qcm_extractor"
assert manifest["version"] == "2.0.0"
assert manifest["phase"] == 2
manifest_paths = set()
for entry in manifest["generated_files"]:
    relative = entry["path"]
    path = ROOT / relative
    assert relative not in manifest_paths, f"Entrée dupliquée : {relative}"
    manifest_paths.add(relative)
    assert path.is_file(), f"Fichier du manifeste absent : {relative}"
    assert path.stat().st_size == entry["bytes"], f"Taille incorrecte : {relative}"
    assert sha256(path) == entry["sha256"], f"Empreinte incorrecte : {relative}"

for required in REQUIRED_FILES:
    assert required in manifest_paths, f"Fichier requis absent du manifeste : {required}"

print("OK phase 2 : proxy contraint, sécurité, schémas fournisseur et manifeste")
