# Extracteur de QCM PDF — phase 7.3.1

Cette version applique un workflow séquentiel : cartographie et correction des zones, validation, préparation automatique des lots, extraction des QCM, extraction automatique des illustrations, puis révision question par question et export ZIP.

Les paramètres de constitution des lots et de parallélisme sont exclusivement définis dans `deployment/qcm-extractor-site/private/config/runtime.php`.

Cette archive regroupe les phases 0 à 7. La phase 7 ajoute la révision question par question dans une interface à deux colonnes : le PDF source est affiché à gauche et le contenu extrait, entièrement éditable, à droite.

Aucun compte, aucune base de données et aucun stockage applicatif des PDF ne sont utilisés. Le PDF original, les sous-PDF et les illustrations restent en mémoire dans le navigateur. Le dossier directement exploitable sous OVH Hosting Perso ou MAMP est `deployment/qcm-extractor-site`.

## Arborescence

```text
phase7_qcm_extractor_7.3.1/
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

La cartographie est maintenant contrôlée QCM par QCM. Les boutons **Précédente** et **Suivante** permettent de parcourir les détections, et **Supprimer ce QCM** retire une détection erronée avant la préparation des lots. Sur le dernier QCM, **Valider les zones et continuer** lance automatiquement la planification des lots et la création locale des sous-PDF.

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
