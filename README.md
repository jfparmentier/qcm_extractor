# Extracteur de QCM — Phase 6.0.0

Cette archive regroupe les phases 0 à 6. La phase 6 ajoute la production locale des illustrations à partir des zones d’image déjà définies dans la cartographie. Les pages PDF sont rendues en haute résolution dans le navigateur, puis les zones sont découpées en PNG et associées aux questions extraites.

Aucun compte, aucune base de données et aucun stockage applicatif des PDF ne sont utilisés. Le PDF original, les sous-PDF et les illustrations restent en mémoire dans le navigateur. Le dossier directement exploitable sous OVH Hosting Perso ou MAMP est `deployment/qcm-extractor-site`.

## Arborescence

```text
phase6_qcm_extractor_6.0.0/
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

## Phase 6 : illustrations locales

Après la seconde passe d’extraction :

1. ouvrir l’onglet **Images** ;
2. lancer la génération de toutes les illustrations ou d’une illustration isolée ;
3. contrôler les aperçus, dimensions, tailles, textes alternatifs et jetons d’insertion ;
4. télécharger individuellement les PNG si nécessaire.

Le découpage utilise exactement les zones `essential_image` et `decorative_image` présentes dans la cartographie. La boîte englobante proposée par le LLM pendant la seconde passe sert uniquement à rapprocher les métadonnées ; elle ne remplace jamais la zone définie dans la cartographie. Aucun contrôle de retouche, de redimensionnement de zone ou de remplacement par un fichier local n’est proposé dans cette phase.

Les pages sont rendues séquentiellement à une largeur cible de 2400 pixels, avec une limite mémoire de 18 millions de pixels par page. Plusieurs zones situées sur la même page réutilisent un seul rendu. Les sorties sont des PNG avec fond blanc et des avertissements sont produits lorsque la découpe est trop petite ou anormalement volumineuse.

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
python tests/validate_deployment.py
```

Les tests ne réalisent aucun appel réel au fournisseur LLM.
