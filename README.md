# Extracteur de QCM — Phase 7.0.0

Cette archive regroupe les phases 0 à 7. La phase 7 ajoute la révision question par question dans une interface à deux colonnes : le PDF source est affiché à gauche et le contenu extrait, entièrement éditable, à droite.

Aucun compte, aucune base de données et aucun stockage applicatif des PDF ne sont utilisés. Le PDF original, les sous-PDF et les illustrations restent en mémoire dans le navigateur. Le dossier directement exploitable sous OVH Hosting Perso ou MAMP est `deployment/qcm-extractor-site`.

## Arborescence

```text
phase7_qcm_extractor_7.0.0/
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

Après la seconde passe d’extraction, l’onglet **Révision** s’ouvre automatiquement. Il est également accessible depuis la barre des étapes.

Pour chaque question :

1. contrôler la ou les pages sources dans la colonne de gauche ;
2. modifier le type, le titre, l’énoncé, les propositions, les réponses correctes et le feedback dans la colonne de droite ;
3. vérifier les illustrations associées ;
4. cocher **Question validée** lorsque les contrôles bloquants sont résolus ;
5. utiliser **Précédente** et **Suivante** pour parcourir les questions.

Sur la dernière question, le bouton **Exporter le JSON** devient actif lorsque toutes les questions sont validées. Le fichier produit respecte `schemas/export.schema.json`. Les illustrations sont référencées sous la forme `assets/nom-du-fichier.png`; la constitution d’une archive ZIP complète reste prévue pour la phase d’export dédiée.

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
