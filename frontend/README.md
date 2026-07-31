# Frontend — Phase 1

Cette application React/TypeScript constitue le socle local du futur extracteur de QCM.
Elle charge un PDF depuis le poste de l’utilisateur, le conserve en mémoire, puis l’affiche
avec PDF.js. Aucun endpoint PHP ni appel réseau applicatif n’est utilisé dans cette phase.

## Fonctionnalités réalisées

- sélection d’un PDF par boîte de dialogue ou glisser-déposer ;
- contrôle du type réel par signature `%PDF-` et limite de 50 Mo ;
- chargement en mémoire avec PDF.js ;
- affichage des métadonnées disponibles ;
- rendu de la page courante sur `canvas` avec prise en compte de la densité de pixels ;
- miniatures chargées paresseusement au moyen d’`IntersectionObserver` ;
- navigation par miniatures, boutons, numéro de page et clavier ;
- zoom de 50 % à 250 % ;
- interface adaptative pour écran étroit ;
- gestion explicite des états `empty`, `loading`, `pdf_loaded` et `error` ;
- destruction du document PDF et libération des ressources à la fermeture.

## Prérequis

- Node.js 22.13 ou version ultérieure compatible ;
- npm.

## Installation et exécution

```bash
cd frontend
npm install
npm run dev
```

L’application est alors disponible à l’adresse indiquée par Vite, normalement
`http://127.0.0.1:5173`.

## Vérifications et constructions

```bash
npm run typecheck
npm run build
```

La construction Vite standard produit le répertoire `frontend/dist/` et incorpore les
dépendances installées par npm.

L’archive fournit également un dossier `dist/` déjà déployable. Il peut être régénéré avec :

```bash
npm run build:portable
```

Cette variante utilise des modules ES natifs et charge React ainsi que PDF.js depuis des CDN
versionnés. Le contenu du PDF reste néanmoins local au navigateur et n’est jamais transmis à
ces CDN.

## Raccourcis clavier

| Touche | Action |
|---|---|
| `←` ou `Page précédente` | page précédente |
| `→` ou `Page suivante` | page suivante |
| `+` ou `=` | augmenter le zoom |
| `-` | réduire le zoom |
| `0` | revenir à 100 % |

Les raccourcis sont désactivés lorsque le foyer se trouve dans un champ éditable.

## Structure

```text
src/
├── components/          composants visuels
├── domain/              état et réducteur du projet
├── hooks/               navigation clavier
├── pdf/                 chargement et configuration de PDF.js
├── styles/              feuille de style globale
├── App.tsx               orchestration de l’interface
└── main.tsx              point d’entrée React
```

## Choix techniques

### Absence de stockage

Le fichier est lu avec `File.arrayBuffer()` puis conservé dans l’état de l’application.
Aucun usage de `localStorage`, IndexedDB, cookie applicatif ou téléversement n’est effectué.
Un rechargement ou la fermeture de l’onglet supprime donc le projet courant.

### Worker PDF.js

Le worker PDF.js est référencé par une URL jsDelivr strictement versionnée. Ce choix évite
les échecs observés avec certains serveurs locaux qui ne publient pas les fichiers `.mjs`
avec un type MIME JavaScript approprié. La construction Vite standard ne génère donc plus
de fichier local `pdf.worker.min-*.mjs`.

Le navigateur doit pouvoir accéder à `https://cdn.jsdelivr.net`. Le PDF sélectionné n’est
pas transmis à ce CDN : seul le programme du worker PDF.js y est téléchargé.

### Miniatures

Les pages ne sont pas toutes rendues immédiatement. Les quatre premières miniatures sont
préparées au chargement, puis les suivantes lorsqu’elles approchent de la zone visible.
Cette stratégie limite la consommation de mémoire pour les documents de plusieurs dizaines
de pages.

## Périmètre non inclus

La phase 1 n’effectue pas encore :

- d’appel au proxy PHP ;
- de cartographie par LLM ;
- de découpage en sous-PDF ;
- d’extraction ou d’édition de QCM ;
- de persistance locale volontaire ;
- d’export JSON ou ZIP.
