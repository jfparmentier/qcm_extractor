# Extracteur de QCM — Phase 3.1

Cette archive regroupe les phases 0 à 3 et le correctif d’architecture **3.1.0** destiné aux documents longs. La cartographie complète du PDF est désormais lancée en tâche asynchrone auprès du fournisseur, puis suivie par de courtes requêtes d’état. Cette organisation évite qu’une connexion PHP demeure ouverte pendant plusieurs minutes.

Aucun compte, aucune base de données et aucun stockage applicatif des PDF ne sont utilisés. Le mode asynchrone implique toutefois une conservation temporaire de l’état de réponse par le fournisseur afin de permettre les interrogations de statut. Le dossier directement exploitable sous OVH Hosting Perso ou MAMP est `deployment/qcm-extractor-site`.

## Arborescence

```text
phase3_qcm_extractor_3.1.0/
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
2. Copier le dossier complet sur le serveur.
3. Définir la racine web sur `qcm-extractor-site/public`.
4. Redémarrer Apache sous MAMP après remplacement des fichiers.
5. Contrôler `public/api/diagnostic.php`.

La cartographie utilise trois opérations internes : démarrage, interrogation périodique et annulation. Le jeton de suivi est signé côté serveur, transmis par l’en-tête `X-QCM-Job` et n’est jamais placé dans l’URL.

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

Les tests ne réalisent aucun appel réel au fournisseur LLM.
