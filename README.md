# Extracteur de QCM — Phases 0 à 2

Cette archive contient les contrats JSON de la phase 0, le socle React/TypeScript de la
phase 1 et le proxy PHP sécurisé de la phase 2.

Aucune version déployable `frontend/dist` n’est incluse dans cette livraison, conformément
au périmètre demandé.

## Contenu

```text
phase2_qcm_extractor/
├── backend/
│   ├── public/                  seuls fichiers PHP à exposer au serveur web
│   ├── src/                     validation, sécurité et client OpenAI
│   ├── prompts/                 instructions contrôlées par le serveur
│   ├── schemas/                 schémas stricts destinés au fournisseur
│   ├── config/                  exemples PHP, Apache, Nginx et environnement
│   └── tests/                   tests PHP sans appel réseau
├── frontend/                    source React/TypeScript, sans dossier dist
├── schemas/                     contrats JSON complets du projet
├── examples/                    exemples conformes
├── golden/                      corpus manuel de 20 cas
├── tests/                       validations globales
├── CHANGELOG.md
└── manifest.json
```

## Phase 2 réalisée

Le proxy fournit deux endpoints spécialisés :

```text
POST /api/analyze-map.php
POST /api/extract-questions.php
```

Les requêtes utilisent un corps `application/pdf` brut. PHP lit `php://input` et ne crée
aucun fichier temporaire applicatif. Le fournisseur reçoit le PDF directement dans l’appel
Responses ; le proxy n’utilise pas l’endpoint persistant `/v1/files`.

Les protections mises en œuvre comprennent :

- clé API exclusivement dans l’environnement PHP ;
- modèles, prompts, schémas et limites choisis côté serveur ;
- sortie structurée par JSON Schema strict ;
- `store: false` ;
- contrôle de la signature PDF, du type et de la taille ;
- politique d’origine et CORS exacts ;
- limitation de débit APCu sans stockage de documents ;
- vérification TLS, délais et plafond de réponse ;
- erreurs normalisées sans exposition de la réponse brute du fournisseur ;
- journaux minimaux ne contenant ni PDF, ni prompt, ni clé, ni résultat LLM.

Le frontend contient désormais `src/api/proxyClient.ts`, prêt pour l’intégration de la
cartographie pendant la phase 3. Il n’est pas encore appelé par l’interface de phase 1.

## Démarrage du frontend

```bash
cd frontend
npm install
npm run dev
```

## Démarrage local du proxy

```bash
cd backend
export OPENAI_API_KEY='sk-proj-...'
export QCM_ALLOWED_ORIGINS='http://localhost:5173'
export QCM_RATE_LIMIT_BACKEND='disabled'
php -S 127.0.0.1:8081 -t public
```

La désactivation de la limitation de débit est réservée au développement local. En
production, installez APCu et utilisez `QCM_RATE_LIMIT_BACKEND=apcu`.

La configuration complète et le protocole HTTP sont décrits dans `backend/README.md`.

## Vérifications

```bash
python tests/validate.py
python tests/validate_phase1.py
find backend -name '*.php' -print0 | xargs -0 -n1 php -l
php backend/tests/run.php
python tests/validate_phase2.py
```

Aucun de ces tests n’envoie de document à OpenAI.

## Limites actuelles

La phase 2 fournit l’infrastructure sécurisée, mais l’interface ne lance pas encore la
cartographie. L’affichage de la progression, la validation AJV des réponses de première
passe et la superposition des segments seront réalisés pendant la phase 3.
