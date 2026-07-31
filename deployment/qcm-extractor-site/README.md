# Dossier prêt pour OVH Hosting Perso et MAMP

## Étape obligatoire

Ouvrir `private/config/runtime.php` et remplacer :

```php
'OPENAI_API_KEY' => 'sk-proj-votre-cle',
```

La clé ne doit jamais être placée dans `public/`.

## OVH Hosting Perso

1. Envoyer le dossier complet `qcm-extractor-site` par SFTP/FTP.
2. Dans **Multisite**, définir la racine du domaine ou sous-domaine sur :
   `qcm-extractor-site/public`.
3. Activer HTTPS.
4. Ouvrir le domaine dans le navigateur.

Le fichier `.ovhconfig` est présent à la racine du dossier et dans `public/`; il sélectionne PHP 8.4. Si cette version n’est pas disponible sur
l’hébergement, modifier `app.engine.version` vers une version PHP prise en charge, au minimum 8.2.

## MAMP sans VirtualHost

1. Copier `qcm-extractor-site` dans le dossier `htdocs` de MAMP.
2. Démarrer Apache depuis MAMP.
3. Ouvrir, avec le port configuré dans MAMP :
   `http://localhost:8888/qcm-extractor-site/public/`.

Le frontend et l’API utilisent alors la même origine. Aucun réglage CORS supplémentaire
n’est nécessaire.

## MAMP avec VirtualHost

Définir comme `DocumentRoot` :

```text
/chemin/vers/qcm-extractor-site/public
```

Puis ouvrir l’hôte local choisi. Le dossier `private` reste en dehors de la racine web.

## Test du proxy

Une requête GET sur `public/api/analyze-map.php` doit répondre en JSON avec une erreur 405.
Un appel réel nécessite une requête POST contenant un PDF brut de type `application/pdf`.

## Limites de la phase 2

Le visualiseur PDF fonctionne. Les endpoints PHP sont installés, mais l’interface graphique
ne déclenche pas encore l’analyse LLM : cette liaison appartient à la phase 3.
