#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "deployment" / "qcm-extractor-site"
PUBLIC = SITE / "public"
PRIVATE = SITE / "private"

required = [
    SITE / ".ovhconfig",
    SITE / "README.md",
    PUBLIC / "index.html",
    PUBLIC / ".htaccess",
    PUBLIC / "api" / "analyze-map.php",
    PUBLIC / "api" / "extract-questions.php",
    PUBLIC / "api" / "_entry.php",
    PUBLIC / "api" / "diagnostic.php",
    PUBLIC / "api" / "mapping-status.php",
    PUBLIC / "api" / "mapping-cancel.php",
    PUBLIC / "api" / "extraction-status.php",
    PUBLIC / "api" / "extraction-cancel.php",
    PUBLIC / "api" / "workflow-config.php",
    PUBLIC / ".user.ini",
    PUBLIC / "api" / ".user.ini",
    PRIVATE / ".htaccess",
    PRIVATE / "config" / "runtime.php",
    PRIVATE / "config" / "bootstrap.php",
    PRIVATE / "src" / "Application.php",
    PRIVATE / "src" / "Config.php",
    PRIVATE / "src" / "RateLimiter.php",
    PRIVATE / "src" / "Diagnostics.php",
    PRIVATE / "runtime" / "logs" / ".gitkeep",
    PRIVATE / "prompts" / "mapping.txt",
    PRIVATE / "schemas" / "mapping.openai.schema.json",
]
missing = [path.relative_to(ROOT).as_posix() for path in required if not path.is_file()]
assert not missing, f"Fichiers de déploiement absents : {missing}"

index = (PUBLIC / "index.html").read_text(encoding="utf-8")
assert "./assets/" in index, "Le frontend doit utiliser des ressources relatives."
assert "Phase 7" in index
assert "?v=7.4.0" in index
assert 'name="application-version" content="7.4.0"' in index
assert (PUBLIC / "assets" / "main.js").is_file()

source = (PUBLIC / "api" / "analyze-map.php").read_text(encoding="utf-8")
assert "_entry.php" in source and "qcmRunBackgroundJobEndpoint('mapping', 'start')" in source
for endpoint, action in (("mapping-status.php", "status"), ("mapping-cancel.php", "cancel")):
    source = (PUBLIC / "api" / endpoint).read_text(encoding="utf-8")
    assert "_entry.php" in source and f"qcmRunBackgroundJobEndpoint('mapping', '{action}')" in source
source = (PUBLIC / "api" / "extract-questions.php").read_text(encoding="utf-8")
assert "_entry.php" in source and "qcmRunBackgroundJobEndpoint('extraction', 'start')" in source

entrypoint = (PUBLIC / "api" / "_entry.php").read_text(encoding="utf-8")
assert "dirname(__DIR__, 2) . '/private'" in entrypoint
assert "bootstrap.php" in entrypoint
assert "PHP_BOOTSTRAP_FAILED" in entrypoint
assert (PUBLIC / "api" / "diagnostic.php").is_file()
assert (PUBLIC / ".user.ini").is_file()
assert (PUBLIC / "api" / ".user.ini").is_file()

private_htaccess = (PRIVATE / ".htaccess").read_text(encoding="utf-8")
assert "Require all denied" in private_htaccess
assert "Deny from all" in private_htaccess

runtime = (PRIVATE / "config" / "runtime.php").read_text(encoding="utf-8")
assert "\'OPENAI_API_KEY\' => \'\'" in runtime
assert "QCM_RATE_LIMIT_BACKEND" in runtime and "'file'" in runtime
assert "QCM_RATE_LIMIT_STORAGE_DIR" in runtime
assert "QCM_RATE_LIMIT_LOCAL_REQUESTS" in runtime
assert "QCM_DIAGNOSTIC_LOG_PATH" in runtime
assert "gpt-5-mini" in runtime
assert "QCM_MAPPING_REASONING_EFFORT" in runtime
for marker in ("QCM_BACKGROUND_START_TIMEOUT_SECONDS", "QCM_BACKGROUND_POLL_TIMEOUT_SECONDS", "QCM_BACKGROUND_POLL_INTERVAL_MS", "QCM_BACKGROUND_JOB_TTL_SECONDS"):
    assert marker in runtime

application = (PRIVATE / "src" / "Application.php").read_text(encoding="utf-8")
assert "runBackgroundOperation" in application
assert "HTTP_X_QCM_JOB" in application
assert "$_GET['job']" not in application
client = (PUBLIC / "assets" / "api" / "proxyClient.js").read_text(encoding="utf-8")
assert '"X-QCM-Job"' in client
assert "mapping-status.php" in client and "mapping-cancel.php" in client
assert "?job=" not in client

rate_limiter = (PRIVATE / "src" / "RateLimiter.php").read_text(encoding="utf-8")
assert "flock(" in rate_limiter
assert "*.count" in rate_limiter
assert "isLocalDevelopmentRequest" in rate_limiter
assert "X-RateLimit-Scope" in rate_limiter

all_text = "\n".join(
    path.read_text(encoding="utf-8", errors="ignore")
    for path in SITE.rglob("*")
    if path.is_file()
)
for match in re.findall(r"sk-[A-Za-z0-9_-]{20,}", all_text):
    assert "remplacer" in match.lower() or "never" in match.lower(), f"Clé potentiellement réelle : {match[:12]}…"

for schema_name in ("mapping.openai.schema.json", "extraction.openai.schema.json"):
    json.loads((PRIVATE / "schemas" / schema_name).read_text(encoding="utf-8"))

assert not any(path.name == "node_modules" for path in SITE.rglob("*"))
assert not any(path.suffix == ".map" for path in PUBLIC.rglob("*")), "Les source maps ne doivent pas être déployées."

canvas = (PUBLIC / "assets" / "components" / "PdfPageCanvas.js").read_text(encoding="utf-8")
panel = (PUBLIC / "assets" / "components" / "MappingPanel.js").read_text(encoding="utf-8")
state = (PUBLIC / "assets" / "domain" / "projectState.js").read_text(encoding="utf-8")
for marker in ("onRegionChange", "onRegionAdd", "pdf-region__handle"):
    assert marker in canvas
for marker in ("region-editor", "Tracer", "Supprimer la zone", "Supprimer ce QCM"):
    assert marker in panel
for marker in ("UPDATE_REGION_BBOX", "UPDATE_REGION_ROLE", "ADD_REGION", "DELETE_REGION", "DELETE_SEGMENT"):
    assert marker in state

print("OK déploiement 7.4.0 : ressources anti-cache et révision simplifiée")
