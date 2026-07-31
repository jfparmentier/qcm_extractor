# Déploiement simplifié sur OVH Hosting Perso et MAMP

Le dossier prêt à copier se trouve dans :

```text
deployment/qcm-extractor-site/
```

Il contient le frontend de phase 3, les endpoints PHP, le code privé, les prompts et les schémas. Aucun `npm install` n’est nécessaire sur le serveur.

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

Activer HTTPS. Le dossier `private` reste hors de la racine publique et possède en plus un `.htaccess` bloquant tout accès HTTP.

## MAMP

Copier le dossier dans `htdocs`, démarrer Apache puis ouvrir :

```text
http://localhost:8888/qcm-extractor-site/public/
```

Le port peut différer. Un VirtualHost peut aussi pointer directement vers `public`.

Après la première copie ou après modification de `.user.ini`, **redémarrer complètement les serveurs MAMP**.

## Diagnostic intégré

Ouvrir :

```text
http://localhost:8888/qcm-extractor-site/public/api/diagnostic.php
```

Le diagnostic ne révèle ni la clé API, ni le contenu des PDF. Vérifier notamment :

```json
{
  "curl_available": true,
  "api_key_configured": true,
  "max_execution_time": "150",
  "rate_limit_directory_writable": true,
  "diagnostic_log_directory_writable": true
}
```

Une valeur `max_execution_time` égale à `30` indique que MAMP n’a pas encore pris en compte `.user.ini` ou les directives Apache. Dans ce cas, modifier le `php.ini` de la version PHP active, définir :

```ini
max_execution_time = 180
memory_limit = 512M
```

puis redémarrer MAMP.

## Journal technique privé

Les événements techniques sont écrits dans :

```text
qcm-extractor-site/private/runtime/logs/qcm-proxy.log
```

Le journal contient uniquement des identifiants de requête, durées, statuts HTTP et codes d’erreur. Il n’enregistre jamais le PDF, le prompt, la réponse complète du modèle ou la clé API.

## Réglages de cartographie

La cartographie utilise par défaut :

```php
'QCM_OPENAI_MAPPING_MODEL' => 'gpt-5-mini',
'QCM_MAPPING_REASONING_EFFORT' => 'low',
'QCM_TEXT_VERBOSITY' => 'low',
'QCM_REQUEST_TIMEOUT_SECONDS' => '120',
'QCM_PHP_MAX_EXECUTION_SECONDS' => '150',
```

Le plafond PHP doit rester strictement supérieur au délai de l’appel fournisseur.

## Fonctionnement de la phase 3

1. Le PDF est chargé localement dans le navigateur.
2. Le clic sur **Cartographier** l’envoie au proxy PHP sans stockage applicatif.
3. Le proxy appelle le LLM avec le prompt et le schéma serveur.
4. Le navigateur valide la réponse avec AJV et applique des contrôles métier.
5. Les segments apparaissent dans un panneau et leurs régions sont superposées au PDF.

Une cartographie échouée peut être relancée ; l’appel en cours peut être annulé. La phase 4 utilisera ces segments pour créer localement les sous-PDF.
