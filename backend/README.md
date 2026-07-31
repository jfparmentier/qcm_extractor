# Proxy PHP sécurisé — Phase 3.2

Le proxy expose des opérations métier contraintes :

- `POST /api/analyze-map.php` : démarre la cartographie asynchrone ;
- `POST /api/mapping-status.php` avec `X-QCM-Job` : interroge son état ;
- `POST /api/mapping-cancel.php` avec `X-QCM-Job` : annule la tâche ;
- `POST /api/extract-questions.php` : endpoint de seconde passe, encore synchrone à ce stade.

Le navigateur ne choisit ni modèle, ni prompt, ni schéma. Le PDF est lu depuis `php://input`, incorporé à la requête Responses et n’est pas stocké par l’application. Aucun appel à `/v1/files` n’est réalisé.

## Cartographie asynchrone

La requête initiale utilise `background: true`. Le fournisseur retourne un identifiant de réponse, encapsulé dans un jeton HMAC signé avec une clé dérivée du secret serveur. Le proxy ne conserve donc aucun état de tâche en base ou sur disque. Le fournisseur conserve temporairement l’état de la réponse le temps de l’exécution et de sa récupération.

Le jeton est envoyé dans `X-QCM-Job`, ce qui évite son inscription dans les journaux d’accès sous forme de paramètre d’URL.

## Configuration

Les paramètres spécifiques sont documentés dans `config/environment.example` :

```text
QCM_BACKGROUND_START_TIMEOUT_SECONDS=25
QCM_BACKGROUND_POLL_TIMEOUT_SECONDS=20
QCM_BACKGROUND_POLL_INTERVAL_MS=2000
QCM_BACKGROUND_JOB_TTL_SECONDS=900
```

## Prérequis

- PHP 8.2 ou ultérieur ;
- extensions `curl` et `json` ;
- accès HTTPS sortant à `api.openai.com` ;
- APCu facultatif, ou limiteur par fichiers verrouillés.

## Vérifications

```bash
find backend -name '*.php' -print0 | xargs -0 -n1 php -l
php backend/tests/run.php
```

Les tests n’effectuent aucun appel réseau réel.
