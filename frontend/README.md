# Frontend — Sources des phases 1 à 3

L’application React/TypeScript charge un PDF avec PDF.js, puis déclenche sur demande une
première analyse LLM destinée à cartographier les QCM.

## Fonctionnalités actives

- sélection ou glisser-déposer d’un PDF ;
- contrôle de la signature `%PDF-` et limite locale de 50 Mo ;
- affichage PDF.js avec miniatures, navigation, zoom et raccourcis clavier ;
- conservation du PDF et de la cartographie uniquement en mémoire ;
- appel explicite de `analyze-map.php` avec annulation par `AbortController` ;
- validation AJV du schéma de cartographie ;
- contrôles métier sur les pages, identifiants, coordonnées et chevauchements ;
- panneau de progression, erreurs normalisées et relance ;
- liste interactive des segments et superposition de leurs régions sur le PDF.

## Client du proxy

Le module `src/api/proxyClient.ts` fournit :

```ts
analyzeDocumentMap(pdfBytes, filename, signal)
extractQuestions(pdfBytes, filename, context, signal)
```

Le PDF est envoyé comme corps HTTP brut `application/pdf`. Le navigateur ne peut choisir ni
le modèle, ni le prompt, ni le schéma de sortie. Par défaut, l’API est résolue vers le dossier
`api` adjacent à l’application, ce qui fonctionne à la racine ou dans un sous-dossier.

Pour un proxy séparé :

```bash
VITE_QCM_API_BASE_URL=http://127.0.0.1:8081 npm run dev
```

## Prérequis et exécution

- Node.js 22.13 ou version ultérieure compatible ;
- npm.

```bash
npm install
npm run typecheck
npm run dev
```

La construction standard est produite avec `npm run build`. Le dossier de déploiement fourni
sous `deployment/qcm-extractor-site/public` utilise des modules ES portables et ne nécessite
pas `npm install` sur le serveur.

## Confidentialité

Le PDF reste local jusqu’au clic sur « Cartographier ». Il est alors transmis au proxy PHP et
au fournisseur LLM, mais n’est pas stocké par l’application. Aucun `localStorage`, IndexedDB,
cookie applicatif ou compte utilisateur n’est utilisé.
