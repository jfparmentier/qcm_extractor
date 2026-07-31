# Dossier prêt pour OVH Hosting Perso et MAMP — Phase 3.0.3

## Étape obligatoire

Ouvrir `private/config/runtime.php` et renseigner :

```php
'OPENAI_API_KEY' => 'sk-proj-votre-cle',
```

La clé doit rester dans `private/` et ne jamais être copiée dans `public/`.

## MAMP sans VirtualHost

1. Copier `qcm-extractor-site` dans le dossier `htdocs` de MAMP.
2. Démarrer ou redémarrer Apache.
3. Ouvrir, avec le port configuré dans MAMP :
   `http://localhost:8888/qcm-extractor-site/public/`.
4. Vérifier le diagnostic :
   `http://localhost:8888/qcm-extractor-site/public/api/diagnostic.php`.

Le frontend et l’API utilisent la même origine ; aucune configuration CORS supplémentaire n’est nécessaire.

## MAMP avec VirtualHost

Définir comme `DocumentRoot` :

```text
/chemin/vers/qcm-extractor-site/public
```

Le dossier `private` reste hors de la racine web.

## OVH Hosting Perso

1. Envoyer le dossier complet `qcm-extractor-site` par SFTP ou FTP.
2. Dans **Multisite**, définir la racine du domaine ou sous-domaine sur `qcm-extractor-site/public`.
3. Activer HTTPS.
4. Vérifier `public/api/diagnostic.php` avant le premier essai.

Le fichier `.ovhconfig` sélectionne PHP 8.4. Il peut être ramené à une version disponible sur l’hébergement, au minimum PHP 8.2.

## Diagnostic des erreurs 500

L’interface affiche désormais un extrait de toute réponse HTTP non JSON. Le proxy écrit également un journal non sensible dans :

```text
private/runtime/logs/qcm-proxy.log
```

Les codes importants sont :

- `PHP_TIME_LIMIT_TOO_LOW` : le délai PHP reste trop court ;
- `UPSTREAM_TIMEOUT` : l’appel OpenAI a dépassé le délai configuré ;
- `UPSTREAM_TLS_FAILED` : problème de certificats cURL dans PHP/MAMP ;
- `UPSTREAM_REJECTED_REQUEST` : requête refusée par l’API ;
- `PHP_BOOTSTRAP_FAILED` : erreur avant l’initialisation complète du proxy.

## Délais MAMP

Les fichiers `public/.user.ini` et `public/api/.user.ini` demandent un délai de 180 secondes. Des directives conditionnelles `mod_php` sont aussi incluses dans `public/.htaccess`.

Si le diagnostic indique encore `max_execution_time: 30`, modifier le `php.ini` de la version PHP active :

```ini
max_execution_time = 180
memory_limit = 512M
```

puis redémarrer les serveurs MAMP.

## Dépendances du frontend portable

Le frontend charge React et AJV depuis `esm.sh`, ainsi que PDF.js et son worker depuis `cdn.jsdelivr.net`. Le serveur et le navigateur doivent pouvoir joindre ces domaines.
