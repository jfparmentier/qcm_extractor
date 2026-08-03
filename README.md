# Extracteur de QCM PDF — phase 7.5.1

Cette version applique un workflow séquentiel : cartographie et correction des zones, validation, préparation automatique des lots, extraction des QCM, extraction automatique des illustrations, puis révision question par question et export ZIP.

Les paramètres de constitution des lots et de parallélisme sont exclusivement définis dans `deployment/qcm-extractor-site/private/config/runtime.php`.

Cette archive regroupe les phases 0 à 7. La phase 7 ajoute la révision question par question dans une interface à deux colonnes : le PDF source est affiché à gauche et le contenu extrait, entièrement éditable, à droite.

Aucun compte, aucune base de données et aucun stockage applicatif des PDF ne sont utilisés. Le PDF original, les sous-PDF et les illustrations restent en mémoire dans le navigateur. Le dossier directement exploitable sous OVH Hosting Perso ou MAMP est `deployment/qcm-extractor-site`.

## Arborescence

```text
phase7_qcm_extractor_7.5.1/
├── backend/                         proxy PHP, prompts, schémas et tests
├── frontend/                        sources React/TypeScript
├── deployment/qcm-extractor-site/  dossier prêt pour OVH ou MAMP
├── schemas/                         contrats JSON
├── examples/                        exemples conformes
├── golden/                          corpus manuel de référence
├── tests/                           validations globales
├── CHANGELOG.md
└── manifest.json
```

## Déploiement direct

1. Renseigner la clé dans `deployment/qcm-extractor-site/private/config/runtime.php`.
2. Copier le dossier `qcm-extractor-site` complet sur le serveur.
3. Définir la racine web sur `qcm-extractor-site/public`.
4. Redémarrer Apache sous MAMP après remplacement des fichiers.
5. Contrôler `public/api/diagnostic.php`.

Le frontend portable charge React, PDF.js, AJV et pdf-lib depuis des CDN versionnés. Une connexion internet est nécessaire au chargement initial.

## Phase 7 : révision des questions

Après le chargement du PDF, l’utilisateur choisit une cartographie **automatique** par le LLM ou une cartographie **manuelle** entièrement locale. Le mode manuel permet de créer et supprimer des questions, puis de tracer et supprimer leurs zones directement sur le PDF. Dans les deux modes, les boutons **Précédente** et **Suivante** permettent de parcourir les questions. Sur la dernière question, **Valider** prépare les lots, crée localement les sous-PDF puis lance automatiquement l’extraction des QCM.

Pendant l’extraction, le panneau droit affiche un état global, le temps écoulé, le nombre de lots traités et le nombre de questions extraites. Les lots ne sont plus présentés sous forme de cartes individuelles.

La cartographie utilise uniquement deux catégories géométriques : **Énoncé** et **Illustration essentielle**. Une ou plusieurs zones **Énoncé** regroupent tout le texte du QCM, y compris les propositions, la réponse correcte et le feedback, même lorsque ces éléments sont répartis sur plusieurs pages.

Après l’extraction détaillée et la génération automatique des illustrations, la révision affiche une question à la fois en deux colonnes :

1. la partie correspondante du PDF, recadrée sans superposition de zones, à gauche ;
2. le titre, l’énoncé, les illustrations, les propositions, les réponses correctes et le feedback éditables à droite.

Le LLM doit fournir un titre non vide. Lorsqu’aucun titre explicite n’existe dans la source, il en génère un court et descriptif avec l’origine `generated_by_model`.

Le passage à la question suivante valide automatiquement la question courante. Sur la dernière question, **Exporter le ZIP** reste disponible et valide la dernière question au moment de l’export. L’archive contient `questions.json` et toutes les illustrations PNG sous `assets/`.

## Vérifications

```bash
python tests/validate.py
python tests/validate_phase1.py
find backend -name '*.php' -print0 | xargs -0 -n1 php -l
php backend/tests/run.php
python tests/validate_phase2.py
python tests/validate_phase3.py
python tests/validate_phase4.py
python tests/validate_phase5.py
python tests/validate_phase6.py
python tests/validate_phase7.py
python tests/validate_deployment.py
```

Les tests ne réalisent aucun appel réel au fournisseur LLM.
