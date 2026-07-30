# Extracteur de QCM — Phases 0 et 1

Cette archive contient les contrats de données définis pendant la phase 0 et le socle
frontend réalisé pendant la phase 1.

Le frontend charge et affiche un document PDF exclusivement dans le navigateur. Il ne
contient encore aucun appel vers un LLM, aucun proxy PHP, aucun système de compte et aucun
stockage de fichiers.

## Contenu de l’archive

```text
phase1_qcm_extractor/
├── frontend/                     application React/TypeScript et dossier dist
├── schemas/                      contrats JSON du pipeline à deux passes
├── examples/                     exemples conformes aux contrats
├── golden/                       corpus manuel de 20 cas
├── tests/                        validations Python
├── CHANGELOG.md
├── README.md
└── manifest.json                 empreintes SHA-256
```

## Phase 1 réalisée

Le répertoire `frontend/` fournit :

- un écran d’import par sélection ou glisser-déposer ;
- une vérification de la signature PDF et une limite de taille de 50 Mo ;
- le chargement local du document avec PDF.js ;
- un visualiseur avec page principale, miniatures et métadonnées ;
- une navigation par boutons, numéro de page, miniatures et clavier ;
- un zoom compris entre 50 % et 250 % ;
- une machine d’état explicite et des écrans d’erreur ;
- une interface adaptative ;
- un dossier `frontend/dist/` directement déployable sur un serveur HTTP(S).

Le fichier PDF demeure dans la mémoire du navigateur. L’application n’emploie ni
`localStorage`, ni IndexedDB, ni base de données, ni téléversement pendant cette phase.

Le dossier `frontend/dist/` fourni est une construction portable reposant sur des modules ES.
Il charge React depuis `esm.sh` et PDF.js depuis `cdn.jsdelivr.net`, mais ne transmet jamais le
PDF sélectionné. Pour un paquet totalement autonome, exécutez `npm install` puis
`npm run build` sur une machine disposant d’un accès au registre npm.

## Démarrage du frontend

```bash
cd frontend
npm install
npm run dev
```

Vérification du typage et construction de production :

```bash
npm run typecheck
npm run build
```

Déploiement immédiat : copiez le contenu de `frontend/dist/` dans le répertoire public de
votre serveur web. Des informations plus détaillées sont disponibles dans
`frontend/README.md` et `frontend/dist/DEPLOYMENT.md`.

## Validation de l’archive

Depuis la racine :

```bash
python tests/validate.py
python tests/validate_phase1.py
```

Le premier script valide les schémas, les exemples et le corpus de la phase 0. Le second
contrôle la structure du frontend, ses dépendances déclarées, l’absence de mécanismes de
stockage ou d’appels réseau applicatifs et l’intégrité du manifeste.

## Contrats de données de la phase 0

- `schemas/mapping.schema.json` : cartographie globale réalisée lors de la première passe ;
- `schemas/extraction.schema.json` : extraction détaillée des QCM lors de la seconde passe ;
- `schemas/export.schema.json` : format final validé ;
- `schemas/golden-dataset.schema.json` : structure du corpus de référence.

Le format canonique du contenu est `markdown-latex`. Les coordonnées d’images sont
normalisées entre 0 et 1, avec une origine située dans le coin supérieur gauche de la page.
La provenance des réponses correctes distingue les informations explicites, inférées,
fournies par l’utilisateur et absentes du document.

## Limites actuelles

La cartographie LLM, le proxy PHP, le découpage local en sous-PDF, l’éditeur de QCM,
l’extraction des illustrations et l’export final seront ajoutés dans les phases suivantes.
