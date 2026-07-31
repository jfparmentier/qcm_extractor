# Proxy PHP sécurisé — Phase 2

Le proxy expose deux opérations métier contraintes :

- `POST /api/analyze-map.php` : première passe de cartographie globale ;
- `POST /api/extract-questions.php` : seconde passe d’extraction détaillée.

Le navigateur ne fournit jamais le modèle, le prompt, le schéma JSON ni la limite de tokens.
Ces éléments sont sélectionnés exclusivement par le serveur. Le proxy transmet le PDF encodé en Base64 à
l’API Responses avec `store: false` et ne crée aucun objet via `/v1/files`.

## Prérequis

- PHP 8.2 ou version ultérieure ;
- extensions PHP `curl` et `json` ;
- extension `apcu` facultative ; un backend de compteurs fichiers est également fourni ;
- accès HTTPS sortant vers `api.openai.com`.

Aucune dépendance Composer ni base de données n’est utilisée. Le backend `file` écrit uniquement de petits compteurs anonymisés pour la limitation de débit ; les PDF ne sont jamais stockés.

## Configuration

Les variables sont lues directement dans l’environnement du processus PHP. Le fichier
`config/environment.example` est un modèle documentaire : il n’est pas chargé
automatiquement et ne doit jamais être renommé avec une clé réelle dans l’arborescence
publique.

Exemple pour le serveur PHP intégré :

```bash
cd backend
export OPENAI_API_KEY='sk-proj-...'
export QCM_ALLOWED_ORIGINS='http://localhost:5173'
export QCM_RATE_LIMIT_BACKEND='file'
export QCM_RATE_LIMIT_STORAGE_DIR='/tmp/qcm-proxy-rate-limit'
php -S 127.0.0.1:8081 -t public
```

Le frontend peut alors utiliser :

```bash
VITE_QCM_API_BASE_URL=http://127.0.0.1:8081 npm run dev
```

En production, utilisez `QCM_RATE_LIMIT_BACKEND=file` sur un hébergement mutualisé, ou `apcu` lorsque l’extension est disponible. Si un répartiteur ou un CDN masque l’adresse cliente, renseignez ses adresses exactes dans `QCM_TRUSTED_PROXY_ADDRESSES` ; autrement, le proxy ignore `X-Forwarded-For`.

## Protocole HTTP

Le corps est le PDF brut. Cette convention évite `multipart/form-data` et donc la création
automatique d’un fichier temporaire par PHP.

```http
POST /api/analyze-map.php HTTP/1.1
Content-Type: application/pdf
X-QCM-Filename: QuestionsPhysique2Elec.pdf

%PDF-...
```

Pour la seconde passe, `X-QCM-Context` contient un petit objet JSON encodé en Base64 URL-safe.
Seules les propriétés suivantes sont acceptées : `batch_id`, `segment_ids`,
`original_page_numbers` et `segment_page_map`. Les prompts libres, modèles ou paramètres LLM
sont rejetés.

Exemple de test avec `curl` :

```bash
curl --fail-with-body \
  -X POST http://127.0.0.1:8081/analyze-map.php \
  -H 'Origin: http://localhost:5173' \
  -H 'Content-Type: application/pdf' \
  -H 'X-QCM-Filename: QuestionsPhysique2Elec.pdf' \
  --data-binary '@/chemin/QuestionsPhysique2Elec.pdf'
```

## Réponse normalisée

Succès :

```json
{
  "ok": true,
  "request_id": "...",
  "operation": "analyze-map",
  "data": {},
  "meta": {
    "provider_response_id": "resp_...",
    "provider_request_id": "req_...",
    "model": "gpt-5",
    "usage": {
      "input_tokens": 100,
      "output_tokens": 50,
      "total_tokens": 150
    }
  }
}
```

Erreur :

```json
{
  "ok": false,
  "request_id": "...",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Trop de requêtes ont été envoyées.",
    "retryable": true
  }
}
```

Le proxy ne renvoie pas la réponse d’erreur brute du fournisseur et ne journalise ni le PDF,
ni les prompts, ni la clé API, ni la sortie du modèle.

## Protections réalisées

- clé API lue exclusivement dans l’environnement serveur ;
- URL fournisseur figée sur `https://api.openai.com/v1/responses` ;
- `store: false` sur chaque requête ;
- absence d’appel à `/v1/files` ;
- modèle, prompts, schémas et limites fixés côté serveur ;
- validation de la méthode, du type MIME, de la taille et de la signature `%PDF-` ;
- lecture de `php://input`, sans stockage de fichier ;
- politique d’origine exacte et prérequêtes CORS contrôlées ;
- limitation de débit APCu ou fichiers verrouillés par adresse et opération ;
- prise en charge facultative de `X-Forwarded-For` uniquement pour des reverse proxies explicitement approuvés ;
- vérification TLS, absence de redirection et délais cURL ;
- plafond sur la taille de la réponse du fournisseur ;
- en-têtes `no-store`, CSP, anti-MIME-sniffing et anti-framing ;
- erreurs publiques normalisées et journaux minimaux.

## Vérifications

```bash
find backend -name '*.php' -print0 | xargs -0 -n1 php -l
php backend/tests/run.php
python tests/validate_phase2.py
```

Les tests n’effectuent aucun appel réel à OpenAI.

## Références techniques

- API Responses et entrées de fichiers : `https://platform.openai.com/docs/api-reference/responses`
- Guide de démarrage et analyse de fichiers : `https://platform.openai.com/docs/quickstart`
- Contrôles de conservation : `https://platform.openai.com/docs/models/default-usage-policies-by-endpoint`
