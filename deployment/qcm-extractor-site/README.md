# Dossier de déploiement OVH / MAMP — Phase 7.0.0

Ce dossier peut être copié tel quel sur le serveur. La racine web doit pointer vers `public`, tandis que `private` contient le proxy, les prompts, les schémas et la configuration secrète.

1. Renseigner `private/config/runtime.php`.
2. Placer le dossier sous `htdocs` pour MAMP, ou sur l’espace FTP OVH.
3. Servir `public/` par Apache.
4. Vérifier `public/api/diagnostic.php`.

La cartographie et l’extraction détaillée sont asynchrones. La production des illustrations est entièrement locale : le navigateur rend les pages PDF en haute résolution puis découpe les zones d’image existantes en PNG. Les PDF et PNG ne sont pas enregistrés par le serveur ; seuls de petits compteurs de limitation de débit et un journal technique non sensible peuvent être écrits sous `private/runtime`.


## Révision et export JSON

Après l’extraction, ouvrir l’onglet **Révision**. Les questions sont présentées une par une, avec le PDF source à gauche et l’éditeur à droite. Le bouton d’export apparaît sur la dernière question et reste désactivé tant que toutes les questions ne sont pas validées.
