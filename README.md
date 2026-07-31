# Extracteur de QCM — Phase 5.0.1

Cette archive regroupe les phases 0 à 5. La version **5.0.1** corrige le chargement initial du schéma AJV en mode strict et conserve la seconde passe d’extraction : les sous-PDF préparés localement sont transmis par lots au proxy PHP, analysés de manière asynchrone, validés puis fusionnés dans l’ordre du document.

Aucun compte, aucune base de données et aucun stockage applicatif des PDF ne sont utilisés. Le PDF original et les sous-PDF restent en mémoire dans le navigateur. Le dossier directement exploitable sous OVH Hosting Perso ou MAMP est `deployment/qcm-extractor-site`.

## Arborescence

```text
phase5_qcm_extractor_5.0.1/
├── backend/                         proxy PHP, prompts, schémas et tests
├── frontend/                        sources React/TypeScript
├── deployment/qcm-extractor-site/ dossier prêt pour OVH ou MAMP
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

## Phase 5 : extraction détaillée

Après la cartographie et la planification des lots :

1. ouvrir l’onglet **Extraction** ;
2. choisir le nombre de lots simultanés et le nombre maximal de reprises ;
3. lancer tous les lots ou un lot isolé ;
4. suivre les états de transmission, file d’attente et analyse ;
5. contrôler les questions fusionnées et les segments manquants.

Pour chaque lot, le navigateur transmet le sous-PDF ainsi qu’un contexte strictement structuré : identifiants des segments, correspondance des pages locales et originales, types indicatifs et zones corrigées. Le prompt et le schéma de sortie restent imposés par le serveur. Les tâches longues utilisent le mode asynchrone du fournisseur et peuvent être annulées.

La sortie est contrôlée par JSON Schema puis normalisée : pages originales, identifiants de réponses, provenance des réponses, régions d’images, segments absents et doublons. Les identifiants globaux des questions sont réécrits lors de la fusion.

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
python tests/validate_deployment.py
```

Les tests ne réalisent aucun appel réel au fournisseur LLM.
