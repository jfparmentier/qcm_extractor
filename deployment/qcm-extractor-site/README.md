# Dossier prêt pour OVH Hosting Perso et MAMP — Phase 3

## Étape obligatoire

Ouvrir `private/config/runtime.php` et renseigner :

```php
'OPENAI_API_KEY' => 'sk-proj-votre-cle',
```

La clé doit rester dans `private/` et ne jamais être copiée dans `public/`.

## OVH Hosting Perso

1. Envoyer le dossier complet `qcm-extractor-site` par SFTP ou FTP.
2. Dans **Multisite**, définir la racine du domaine ou sous-domaine sur
   `qcm-extractor-site/public`.
3. Activer HTTPS.
4. Ouvrir le domaine, charger un PDF puis cliquer sur **Cartographier**.

Le fichier `.ovhconfig` sélectionne PHP 8.4. Il peut être ramené à une version disponible sur
l’hébergement, au minimum PHP 8.2.

## MAMP sans VirtualHost

1. Copier `qcm-extractor-site` dans le dossier `htdocs` de MAMP.
2. Démarrer Apache.
3. Ouvrir, avec le port configuré dans MAMP :
   `http://localhost:8888/qcm-extractor-site/public/`.

Le frontend et l’API utilisent la même origine ; aucune configuration CORS supplémentaire
n’est nécessaire.

## MAMP avec VirtualHost

Définir comme `DocumentRoot` :

```text
/chemin/vers/qcm-extractor-site/public
```

Le dossier `private` reste hors de la racine web.

## Test rapide

Une requête GET sur `public/api/analyze-map.php` doit répondre en JSON avec une erreur 405.
Après configuration de la clé, le bouton **Cartographier** doit afficher une progression, puis
la liste des segments et leurs zones sur les pages du PDF.

## Dépendances du frontend portable

Le frontend charge React et AJV depuis `esm.sh`, ainsi que PDF.js et son worker depuis
`cdn.jsdelivr.net`. Le serveur et le navigateur doivent donc pouvoir joindre ces domaines.
