# Déploiement sur OVH Hosting Perso et MAMP — version 3.1.1

Le dossier à copier est :

```text
deployment/qcm-extractor-site/
```

## Préparation

Renseigner `OPENAI_API_KEY` dans :

```text
deployment/qcm-extractor-site/private/config/runtime.php
```

## MAMP

Copier le dossier dans `htdocs`, redémarrer complètement Apache, puis ouvrir par exemple :

```text
http://localhost:8888/qcm-extractor-site/public/
```

Le port dépend de la configuration MAMP. Le diagnostic est disponible sous `public/api/diagnostic.php`.

## OVH Hosting Perso

Téléverser le dossier complet et définir la racine du domaine ou sous-domaine sur :

```text
qcm-extractor-site/public
```

Le dossier `private` doit rester hors de la racine publique. Activer HTTPS avant l’utilisation.

## Cartographie longue

La première passe n’attend plus la fin du LLM dans une connexion PHP unique :

1. `analyze-map.php` envoie le PDF et démarre une tâche asynchrone ;
2. le navigateur reçoit un jeton signé ;
3. il appelle périodiquement `mapping-status.php` ;
4. il récupère le JSON lorsque l’état devient `completed` ;
5. une annulation appelle `mapping-cancel.php`.

Les requêtes PHP de suivi sont courtes. Le PDF n’est pas écrit sur le disque du serveur. Le jeton de suivi n’est pas inclus dans l’URL.

## Paramètres principaux

```php
'QCM_BACKGROUND_START_TIMEOUT_SECONDS' => '25',
'QCM_BACKGROUND_POLL_TIMEOUT_SECONDS' => '20',
'QCM_BACKGROUND_POLL_INTERVAL_MS' => '2000',
'QCM_BACKGROUND_JOB_TTL_SECONDS' => '900',
```

Le délai synchrone `QCM_REQUEST_TIMEOUT_SECONDS` reste utilisé pour la future seconde passe.

## Journal technique

```text
private/runtime/logs/qcm-proxy.log
```

Le journal ne contient ni PDF, ni prompt, ni réponse complète, ni clé API. Les nouveaux événements utiles sont `background_job_started`, `background_job_completed` et `background_job_cancelled`.

## Quotas de test MAMP

La version 3.1.1 distingue automatiquement les essais réellement locaux des requêtes publiques. La valeur `QCM_RATE_LIMIT_LOCAL_REQUESTS=100` s’applique seulement si l’adresse cliente est une boucle locale et si le site est ouvert avec `localhost`, `127.0.0.1` ou `::1`. La limite publique demeure définie par `QCM_RATE_LIMIT_REQUESTS=10`.
