# Extracteur de QCM PDF

Application web de cartographie, d’extraction et de révision de questionnaires à choix multiple à partir de fichiers PDF.

Licence : [CC0 1.0 Universal](LICENSE)

## À propos

L’Extracteur de QCM transforme un PDF en un jeu de questions structuré et éditable. Il permet de repérer les questions automatiquement avec un LLM ou de les cartographier manuellement, puis d’extraire leur contenu, de vérifier le résultat et de produire une archive ZIP réutilisable.

Le traitement du PDF, des sous-PDF et des illustrations est réalisé en mémoire. L’application ne nécessite ni compte utilisateur, ni base de données, ni stockage applicatif des documents.

## Fonctionnalités

- chargement et visualisation locale d’un PDF ;
- cartographie automatique assistée par LLM ou cartographie manuelle ;
- création et suppression de questions et de zones ;
- zones **Énoncé** et **Illustrations**, y compris sur plusieurs pages ;
- extraction structurée des QCM par lots ;
- génération locale des illustrations à partir des zones sélectionnées ;
- révision question par question avec les zones d’énoncé regroupées à gauche ;
- édition du titre, de l’énoncé, des choix, des réponses correctes et du feedback ;
- export ZIP contenant les données JSON et les illustrations PNG.

## Prérequis

Pour utiliser le paquet de déploiement :

- PHP 8.2 ou version ultérieure ;
- extensions PHP `curl` et `json` ;
- Apache, par exemple avec MAMP, ou un hébergement PHP compatible ;
- une clé d’API OpenAI et un accès HTTPS sortant à `api.openai.com` ;
- une connexion internet pour charger les dépendances JavaScript du paquet préconstruit.

Pour modifier le frontend, il faut également Node.js 22.13 ou version ultérieure.

## Démarrage rapide

Le dossier [`deployment/qcm-extractor-site`](deployment/qcm-extractor-site) contient une version directement exploitable sous MAMP ou sur un hébergement OVH compatible.

1. Placez ce dossier dans le répertoire servi par Apache.
2. Renseignez `OPENAI_API_KEY` dans `deployment/qcm-extractor-site/private/config/runtime.php`.
3. Faites pointer la racine web vers `deployment/qcm-extractor-site/public` afin de garder `private` hors de la partie publique.
4. Démarrez ou redémarrez Apache.
5. Ouvrez `public/api/diagnostic.php` pour vérifier la configuration, puis accédez à l’application.

Avec la configuration MAMP par défaut du projet, l’application est par exemple disponible à l’adresse suivante :

```text
http://localhost:8888/qcm-extractor-site/public/
```

Les instructions détaillées figurent dans le guide [Déploiement sur OVH et MAMP](DEPLOIEMENT_OVH_MAMP.md).

> [!IMPORTANT]
> Ne placez jamais une clé d’API réelle dans Git. Le fichier `private/config/runtime.php` doit rester inaccessible depuis le Web et toute clé exposée doit être révoquée immédiatement.

## Utilisation

1. Déposez un fichier PDF dans l’application.
2. Choisissez la cartographie automatique ou manuelle.
3. Créez ou corrigez les questions et leurs zones **Énoncé** et **Illustrations**.
4. Cliquez sur **Extraire les QCM**.
5. Vérifiez et modifiez chaque question extraite.
6. Cliquez sur **Exporter le ZIP**.

La cartographie manuelle est réalisée localement dans le navigateur. L’extraction structurée utilise néanmoins le LLM configuré sur le serveur et transmet les sous-PDF nécessaires au fournisseur OpenAI.

L’archive produite suit cette structure :

```text
nom-du-document-qcm.zip
├── questions.json
└── assets/
    ├── q-001-01.png
    └── ...
```

## Développement

Installez les dépendances du frontend :

```bash
cd frontend
npm ci
```

Lancez ensuite le frontend Vite en lui indiquant l’API PHP déjà servie par Apache :

```bash
export VITE_QCM_API_BASE_URL=http://127.0.0.1:8888/qcm-extractor-site/public/api
npm run dev
```

Commandes principales :

```bash
npm run typecheck
npm run build
npm run preview
```

Le frontend de développement est disponible sur `http://127.0.0.1:5173`. Les origines autorisées, les modèles et les paramètres de lots sont configurés exclusivement côté serveur.

## Structure du dépôt

```text
.
├── frontend/                        application React et TypeScript
├── backend/                         proxy PHP, prompts, schémas et tests
├── deployment/qcm-extractor-site/  paquet prêt pour MAMP ou OVH
├── schemas/                         contrats JSON
├── examples/                        exemples de données conformes
├── golden/                          corpus manuel de référence
├── tests/                           validations globales
├── CHANGELOG.md
└── manifest.json
```

## Confidentialité et sécurité

- La clé OpenAI reste côté serveur et ne doit jamais être intégrée au frontend.
- Le proxy n’enregistre ni les PDF, ni les réponses complètes du LLM.
- Les journaux techniques excluent les documents, les prompts et les secrets.
- La production doit utiliser HTTPS et conserver le dossier `private` hors de la racine web.
- Avant d’envoyer un document, vérifiez que son traitement par le fournisseur LLM respecte vos obligations de confidentialité.

## Vérifications

Les tests locaux ne réalisent aucun appel réel au fournisseur LLM.

```bash
python3 tests/validate.py
python3 tests/validate_phase1.py
python3 tests/validate_phase2.py
python3 tests/validate_phase3.py
python3 tests/validate_phase4.py
python3 tests/validate_phase5.py
python3 tests/validate_phase6.py
python3 tests/validate_phase7.py
python3 tests/validate_deployment.py
find backend -name '*.php' -print0 | xargs -0 -n1 php -l
php backend/tests/run.php
```

Pour valider le frontend :

```bash
cd frontend
npm ci
npm run typecheck
npm run build
```

## Aide

Consultez d’abord le [guide de déploiement](DEPLOIEMENT_OVH_MAMP.md) et le point de diagnostic `public/api/diagnostic.php`. Si le problème persiste, ouvrez une issue GitHub en précisant les étapes de reproduction, le navigateur, la version de PHP et l’identifiant technique de la requête lorsque celui-ci est disponible.

N’ajoutez jamais de clé d’API ou de PDF confidentiel dans une issue publique.

## Contribuer

Les corrections et améliorations sont bienvenues :

1. créez une branche dédiée ;
2. limitez la modification à un objectif clair ;
3. ajoutez ou adaptez les tests concernés ;
4. exécutez les vérifications ci-dessus ;
5. ouvrez une pull request décrivant le changement et sa méthode de validation.

Le projet est maintenu dans ce dépôt ; les issues et les pull requests sont les canaux privilégiés pour proposer une évolution.

## Licence

Le contenu original de ce dépôt est placé sous [CC0 1.0 Universal](LICENSE), identifiant SPDX `CC0-1.0`. Dans la mesure permise par la loi, il peut être copié, modifié et redistribué, y compris à des fins commerciales, sans demander d’autorisation.

Les bibliothèques, services et autres composants tiers conservent leurs licences et conditions respectives.
