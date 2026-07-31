#!/bin/sh
set -eu
BASE_URL="${1:-http://localhost:8888/qcm-extractor-site/public}"
printf 'Test de %s/api/analyze-map.php\n' "$BASE_URL"
curl -sS -i "$BASE_URL/api/analyze-map.php"
printf '\nUne réponse HTTP 405 en JSON confirme que PHP et le routage fonctionnent.\n'
