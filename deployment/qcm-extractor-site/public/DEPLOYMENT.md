# Déploiement du dossier public — Phase 7.5.1

Le contenu de ce dossier constitue la racine HTTP. Il comprend le frontend portable et les endpoints PHP de cartographie et d’extraction.

Les ressources utilisent des chemins relatifs. Les bibliothèques JavaScript sont chargées depuis les CDN versionnés déclarés dans `index.html`.

## Enchaînement de l’interface

La cartographie est vérifiée QCM par QCM. Une détection peut être supprimée avant la validation finale des zones. Les lots et les sous-PDF sont ensuite préparés automatiquement selon les paramètres du serveur.

Après l’extraction des QCM, les illustrations sont générées automatiquement. La révision affiche une question à la fois, avec la partie correspondante du PDF à gauche, sans zones superposées, et l’éditeur à droite.

Le passage à la question suivante valide la question courante. Le bouton **Exporter le ZIP**, affiché sur la dernière question, valide celle-ci puis produit une archive contenant `questions.json` et les illustrations PNG sous `assets/`.
