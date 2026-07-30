# Journal des modifications

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
