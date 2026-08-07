# Déploiement QCM Extractor 7.6.1

Le dossier `qcm-extractor-site` est directement utilisable avec MAMP ou OVH. Le traitement suit une seule étape visible à la fois.

## Paramètres du workflow

Les paramètres de planification des lots et d’extraction sont définis dans `private/config/runtime.php` avec les clés `QCM_BATCH_*` et `QCM_EXTRACTION_MAX_*`. Ils sont transmis au navigateur par `public/api/workflow-config.php` sans divulguer la clé API.

Ce dossier peut être copié tel quel sur le serveur. La racine web doit pointer vers `public`, tandis que `private` contient le proxy, les prompts, les schémas et la configuration secrète.

1. Renseigner `private/config/runtime.php`.
2. Enrichir si nécessaire `private/config/allowed-email-domains.php`.
3. Placer le dossier sous `htdocs` pour MAMP, ou sur l’espace FTP OVH.
4. Servir `public/` par Apache.
5. Vérifier `public/api/diagnostic.php`.

## Connexion par email

L’accès à l’application requiert une adresse appartenant à un domaine autorisé. La validation est effectuée par `public/api/auth.php`, puis conservée dans une session PHP avec cookie `HttpOnly`.

La liste à modifier sur le serveur est `private/config/allowed-email-domains.php`. Ajoutez une entrée par domaine ; le préfixe `@` est facultatif. Les domaines actuellement autorisés sont `@ipsa.fr` et `@irit.fr`.

La cartographie et l’extraction détaillée sont asynchrones. La production des illustrations est entièrement locale : le navigateur rend les pages PDF en haute résolution puis découpe les zones d’image validées en PNG. Les PDF et PNG ne sont pas enregistrés par le serveur ; seuls de petits compteurs de limitation de débit et un journal technique non sensible peuvent être écrits sous `private/runtime`.

## Workflow de validation

La cartographie peut être automatique, avec détection par le LLM, ou manuelle et entièrement locale. Dans les deux modes, l’utilisateur peut créer ou supprimer des questions, tracer ou supprimer leurs zones et naviguer entre les QCM. Après validation du dernier QCM, les lots et les sous-PDF sont préparés automatiquement, puis l’extraction détaillée est lancée depuis l’étape suivante.

Chaque question extraite possède un titre. Lorsque le document n’en fournit pas, le LLM génère un titre descriptif court. Le feedback est également affiché dans l’éditeur et généré par le LLM lorsqu’il n’existe pas dans le PDF.

## Révision et export ZIP

Lorsque l’extraction détaillée est terminée, les illustrations sont générées automatiquement, puis la révision s’ouvre. Les questions sont présentées une par une : la partie correspondante du PDF est affichée à gauche, sans superposition des zones, et le contenu éditable apparaît à droite.

Le passage à la question suivante valide automatiquement la question courante. Sur la dernière question, le bouton **Exporter le ZIP** reste disponible ; son activation valide la dernière question puis produit l’archive.

L’export final contient :

```text
nom-du-document-qcm.zip
├── questions.json
└── assets/
    ├── q-001-01.png
    └── ...
```

## Cartographie des zones

La cartographie propose uniquement les catégories **Énoncé** et **Illustration essentielle**. La catégorie **Énoncé** couvre l’ensemble du texte du QCM et peut être utilisée plusieurs fois sur plusieurs pages.
