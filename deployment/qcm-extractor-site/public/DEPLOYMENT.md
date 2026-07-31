# Racine publique

Ce dossier doit être la racine web du site.

Le code serveur, la clé API, les prompts, les schémas et les journaux se trouvent dans le dossier frère `../private`, qui ne doit pas être exposé par le serveur HTTP.

Avant le premier essai, ouvrir :

```text
api/diagnostic.php
```

Le diagnostic ne révèle aucun secret. Il permet de vérifier cURL, la durée d’exécution PHP et les permissions des dossiers privés.

Sous MAMP, redémarrer Apache après toute modification de `.user.ini` ou de `php.ini`.
