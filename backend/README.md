# Proxy PHP sécurisé — Phase 5.0

Le proxy expose deux opérations asynchrones contraintes.

Cartographie :

- `POST /api/analyze-map.php` ;
- `POST /api/mapping-status.php` avec `X-QCM-Job` ;
- `POST /api/mapping-cancel.php` avec `X-QCM-Job`.

Extraction :

- `POST /api/extract-questions.php` avec `X-QCM-Context` ;
- `POST /api/extraction-status.php` avec `X-QCM-Job` ;
- `POST /api/extraction-cancel.php` avec `X-QCM-Job`.

Le navigateur ne choisit ni modèle, ni prompt, ni schéma. Le PDF est lu depuis `php://input`, incorporé à la requête Responses et n’est pas stocké par l’application. Aucun appel à `/v1/files` n’est réalisé.

Le contexte d’extraction accepte uniquement des métadonnées structurées et bornées : lot, segments, pages, types indicatifs et régions normalisées. Toute propriété inconnue est rejetée.

## Contrôle d’accès par email

`GET /api/auth.php` vérifie la session courante et `POST /api/auth.php` ouvre une session après validation de l’adresse email. Les opérations de cartographie et d’extraction exigent ensuite ce cookie de session.

La liste blanche se trouve dans `backend/config/allowed-email-domains.php`. Ajoutez une chaîne par domaine ; le préfixe `@` est facultatif et les sous-domaines doivent être déclarés explicitement.

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
