# Déploiement simplifié sur OVH Hosting Perso et MAMP

Le dossier prêt à copier se trouve dans :

```text
deployment/qcm-extractor-site/
```

Il contient le frontend préconstruit, les endpoints PHP, le code privé, les prompts et les
schémas. Aucun `npm install` n’est nécessaire pour ce dossier.

## Préparation unique

Modifier :

```text
deployment/qcm-extractor-site/private/config/runtime.php
```

et renseigner `OPENAI_API_KEY`.

## OVH

Téléverser le dossier complet puis définir la racine du domaine ou sous-domaine sur :

```text
qcm-extractor-site/public
```

Le dossier `private` est hors de cette racine et possède aussi un `.htaccess` de blocage.

## MAMP

Copier le dossier dans `htdocs`, démarrer Apache puis ouvrir :

```text
http://localhost:8888/qcm-extractor-site/public/
```

Le port peut différer selon la configuration de MAMP. Cette méthode ne nécessite aucun
VirtualHost. Un VirtualHost peut néanmoins pointer directement vers le dossier `public`.

## État fonctionnel

La phase 2 fournit un visualiseur PDF et un proxy LLM sécurisé. Le bouton d’analyse et
l’exploitation de la cartographie seront ajoutés pendant la phase 3.
