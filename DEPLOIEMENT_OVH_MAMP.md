# Déploiement simplifié sur OVH Hosting Perso et MAMP

Le dossier prêt à copier se trouve dans :

```text
deployment/qcm-extractor-site/
```

Il contient le frontend de phase 3, les endpoints PHP, le code privé, les prompts et les
schémas. Aucun `npm install` n’est nécessaire sur le serveur.

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

Activer HTTPS. Le dossier `private` reste hors de la racine publique et possède en plus un
`.htaccess` bloquant tout accès HTTP.

## MAMP

Copier le dossier dans `htdocs`, démarrer Apache puis ouvrir :

```text
http://localhost:8888/qcm-extractor-site/public/
```

Le port peut différer. Un VirtualHost peut aussi pointer directement vers `public`.

## Fonctionnement de la phase 3

1. Le PDF est chargé localement dans le navigateur.
2. Le clic sur **Cartographier** l’envoie au proxy PHP sans stockage applicatif.
3. Le proxy appelle le LLM avec le prompt et le schéma serveur.
4. Le navigateur valide la réponse avec AJV et applique des contrôles métier.
5. Les segments apparaissent dans un panneau et leurs régions sont superposées au PDF.

Une cartographie échouée peut être relancée ; l’appel en cours peut être annulé. La phase 4
utilisera ces segments pour créer localement les sous-PDF.
