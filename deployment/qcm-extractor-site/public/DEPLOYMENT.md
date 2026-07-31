# Racine publique

Ce dossier est la racine web du site.

- `index.html` et `assets/` constituent le frontend préconstruit ;
- `api/` contient les deux endpoints PHP de phase 2 ;
- le code serveur, les prompts, les schémas et la clé sont dans `../private/`.

Sur OVH, configurez le domaine ou sous-domaine pour qu’il pointe précisément vers ce
dossier. Sous MAMP sans VirtualHost, ouvrez directement le chemin se terminant par
`/qcm-extractor-site/public/`.
