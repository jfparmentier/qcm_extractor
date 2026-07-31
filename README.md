# Extracteur de QCM — Phases 0 à 3

Cette archive contient les contrats JSON de la phase 0, le visualiseur React/TypeScript de la phase 1, le proxy PHP sécurisé de la phase 2 et la première passe de cartographie de la phase 3.

Le dossier directement exploitable sur OVH Hosting Perso ou MAMP se trouve sous `deployment/qcm-extractor-site`. Les sources React et PHP sont également fournies. Aucun compte, aucune base de données et aucun stockage persistant des PDF ne sont utilisés.

## Contenu

```text
phase3_qcm_extractor_3.0.3/
├── backend/                         proxy PHP, prompts, schémas et tests
├── frontend/                        sources React/TypeScript
├── deployment/qcm-extractor-site/ dossier prêt à téléverser sur OVH ou copier dans MAMP
├── schemas/                         contrats JSON complets
├── examples/                        exemples conformes
├── golden/                          corpus manuel de référence
├── tests/                           validations globales
├── CHANGELOG.md
└── manifest.json
```

## Correctif 3.0.3

Cette version traite spécifiquement les erreurs HTTP 500 non JSON observées sous MAMP :

- contrôle de la limite PHP réellement appliquée ;
- configuration locale par `.user.ini` et directives conditionnelles Apache ;
- endpoint `api/diagnostic.php` sans donnée sensible ;
- journal technique privé `private/runtime/logs/qcm-proxy.log` ;
- conversion des échecs d’initialisation en réponses JSON ;
- affichage du type MIME et d’un extrait de la réponse illisible dans l’interface ;
- erreurs cURL différenciées ;
- cartographie accélérée avec `gpt-5-mini`, effort `low` et verbosité `low`.

## Démarrage des sources

```bash
cd frontend
npm install
npm run typecheck
npm run dev
```

Pour utiliser un proxy PHP lancé séparément :

```bash
VITE_QCM_API_BASE_URL=http://127.0.0.1:8081 npm run dev
```

## Déploiement direct

1. Ouvrir `deployment/qcm-extractor-site/private/config/runtime.php`.
2. Renseigner `OPENAI_API_KEY`.
3. Copier le dossier complet sur le serveur.
4. Pointer la racine web vers `qcm-extractor-site/public`, ou ouvrir ce dossier sous MAMP.
5. Ouvrir `public/api/diagnostic.php` et contrôler l’environnement PHP.

Les instructions détaillées figurent dans `DEPLOIEMENT_OVH_MAMP.md`.

## Vérifications

```bash
python tests/validate.py
python tests/validate_phase1.py
find backend -name '*.php' -print0 | xargs -0 -n1 php -l
php backend/tests/run.php
python tests/validate_phase2.py
python tests/validate_phase3.py
python tests/validate_deployment.py
```

Aucun test fourni n’envoie de document au fournisseur LLM.
