# Journal des modifications

## 1.1.4 — Correctif de chargement du worker PDF.js

### Corrigé

- suppression de l’import Vite `pdf.worker.min.mjs?url`, qui produisait un fichier local `.mjs` susceptible d’être servi avec un type MIME incorrect ;
- configuration du worker PDF.js par une URL jsDelivr strictement versionnée ;
- absence de fichier `pdf.worker.min-*.mjs` dans la construction Vite ;
- documentation de la dépendance réseau du worker ;
- mise à jour des validations et du manifeste.

## 1.1.3 — Correctif DocumentInitParameters

### Corrigé

- suppression de l’option `isEvalSupported`, qui ne fait pas partie de `DocumentInitParameters` dans `pdfjs-dist` 6.1.200 ;
- conservation des options compatibles `data` et `useSystemFonts` ;
- régénération de la distribution portable et du manifeste.

## 1.1.2 — Correctif de compatibilité PDF.js 6.1.200

### Corrigé

- suppression de l’import racine non exporté `DocumentInitParameters` ;
- destruction des ressources par `PDFDocumentLoadingTask.destroy()` ;
- compatibilité du typage avec `pdfjs-dist` 6.1.200 ;
- version minimale de Node.js alignée sur l’exigence de PDF.js (`22.13.0`) ;
- régénération du dossier `frontend/dist/`.

## 1.1.1 — Phase 1 avec distribution déployable

### Ajouté

- dossier `frontend/dist/` directement déployable ;
- script reproductible `npm run build:portable` ;
- documentation des dépendances CDN de la construction portable ;

- application frontend React et TypeScript sous `frontend/` ;
- chargement local et validation élémentaire des PDF ;
- visualiseur PDF.js avec page principale et miniatures ;
- navigation par page, clavier et commandes de zoom ;
- gestion d’état par réducteur ;
- écrans de chargement et d’erreur ;
- interface adaptative et règles d’accessibilité de base ;
- contrôle statique propre à la phase 1 ;
- génération reproductible du manifeste SHA-256.

### Conservé

- schémas JSON de la phase 0 ;
- exemples contractuels ;
- corpus de référence de 20 questions ;
- validation structurelle et métier de la phase 0.
