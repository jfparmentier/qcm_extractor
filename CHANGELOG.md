# Journal des modifications

## 2.1.0 — Préparation OVH et MAMP

- ajout du dossier autonome `deployment/qcm-extractor-site` ;
- ajout du frontend préconstruit et des endpoints PHP dans une arborescence public/privé ;
- ajout d’une configuration PHP locale protégée pour la clé API ;
- ajout d’un limiteur de débit par fichiers compatible avec l’hébergement mutualisé ;
- ajout d’une résolution relative automatique de l’URL du proxy ;
- ajout des instructions OVH Hosting Perso et MAMP ;
- désactivation des source maps dans les constructions de production.

## 2.0.0 — Phase 2

- ajout d’un proxy PHP 8.2 sans framework ni dépendance Composer ;
- ajout des endpoints contraints `analyze-map.php` et `extract-questions.php` ;
- transmission des PDF par corps HTTP brut, sans stockage applicatif ;
- intégration de l’API Responses avec fichier PDF incorporé et `store: false` ;
- ajout de prompts serveur et de schémas compatibles avec les sorties structurées strictes ;
- ajout des contrôles de méthode, origine, type MIME, signature et taille ;
- ajout d’une limitation de débit APCu par adresse et opération ;
- ajout de délais cURL, vérification TLS, interdiction des redirections et plafond de réponse ;
- ajout d’un format uniforme de succès et d’erreur ;
- ajout d’une journalisation minimale excluant les contenus sensibles ;
- ajout d’exemples de configuration PHP, Apache et Nginx ;
- ajout du client TypeScript `proxyClient.ts` en préparation de la phase 3 ;
- retrait du dossier `frontend/dist` de cette livraison ;
- ajout des tests PHP et des validations de sécurité de phase 2.

## 1.1.4 — Correctif PDF.js

- chargement du worker PDF.js versionné depuis jsDelivr afin d’éviter les erreurs MIME `.mjs`.

## 1.1.3 — Correctif TypeScript

- suppression de l’option `isEvalSupported` absente des types PDF.js installés.

## 1.1.2 — Correctif PDF.js 6

- destruction des documents via `PDFDocumentLoadingTask.destroy()` ;
- suppression de l’import racine incompatible `DocumentInitParameters`.

## 1.0.0 — Phases 0 et 1

- définition des contrats JSON et du corpus de référence ;
- création du socle React/TypeScript ;
- chargement local et visualisation des PDF.
