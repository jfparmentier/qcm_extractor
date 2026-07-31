# Racine publique — Phase 3

Ce dossier est la racine web du site.

- `index.html` et `assets/` contiennent le frontend de cartographie ;
- `api/` contient les endpoints PHP ;
- le code serveur, les prompts, les schémas et la clé se trouvent dans `../private/`.

Sur OVH, configurez le domaine ou sous-domaine pour qu’il pointe précisément vers ce dossier.
Sous MAMP sans VirtualHost, ouvrez directement le chemin se terminant par
`/qcm-extractor-site/public/`.


### Analyse dépassant 30 secondes

La version 3.0.2 règle automatiquement le délai PHP. Vérifier dans
`../private/config/runtime.php` que `QCM_PHP_MAX_EXECUTION_SECONDS` est strictement supérieur
à `QCM_REQUEST_TIMEOUT_SECONDS`, puis redémarrer MAMP après remplacement des fichiers.
