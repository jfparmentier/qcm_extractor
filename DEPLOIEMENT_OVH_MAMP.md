# Déploiement sur OVH Hosting Perso et MAMP — version 5.0.1

Le dossier à copier est `deployment/qcm-extractor-site/`.

## Préparation

Renseigner `OPENAI_API_KEY` dans `deployment/qcm-extractor-site/private/config/runtime.php`.

## MAMP

Copier le dossier dans `htdocs`, redémarrer Apache, puis ouvrir par exemple :

```text
http://localhost:8888/qcm-extractor-site/public/
```

Le diagnostic est disponible sous `public/api/diagnostic.php`.

## OVH Hosting Perso

Téléverser le dossier complet et définir la racine du domaine ou sous-domaine sur `qcm-extractor-site/public`. Le dossier `private` doit rester hors de la racine publique. HTTPS doit être activé.

## Deux passes asynchrones

La cartographie utilise `analyze-map.php`, `mapping-status.php` et `mapping-cancel.php`. La seconde passe utilise `extract-questions.php`, `extraction-status.php` et `extraction-cancel.php` pour chacun des sous-PDF créés localement.

Le navigateur transmet les métadonnées du lot dans l’en-tête signé applicativement `X-QCM-Context` après validation stricte côté PHP. Les tâches longues sont suivies avec un jeton serveur transmis par `X-QCM-Job`. Les PDF ne sont pas écrits sur le disque de l’application.

## Quotas

La cartographie et l’extraction disposent de compteurs séparés. Les valeurs par défaut sont :

```php
'QCM_RATE_LIMIT_REQUESTS' => '10',
'QCM_RATE_LIMIT_LOCAL_REQUESTS' => '100',
'QCM_RATE_LIMIT_EXTRACTION_REQUESTS' => '40',
'QCM_RATE_LIMIT_LOCAL_EXTRACTION_REQUESTS' => '200',
```

## Journal technique

Le journal `private/runtime/logs/qcm-proxy.log` ne contient ni PDF, ni prompt, ni réponse complète, ni clé API. Il consigne les identifiants de requête, états, durées et codes d’erreur.
