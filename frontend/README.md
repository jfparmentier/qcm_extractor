# Frontend — Sources des phases 1 et 2

L’application React/TypeScript charge et affiche un PDF localement avec PDF.js. La phase 2
ajoute un client HTTP typé dans `src/api/proxyClient.ts`, sans encore le connecter à
l’interface.

## Fonctionnalités actives

- sélection ou glisser-déposer d’un PDF ;
- contrôle de la signature `%PDF-` et limite locale de 50 Mo ;
- affichage PDF.js avec miniatures, navigation et zoom ;
- conservation du document uniquement en mémoire ;
- gestion explicite des états de chargement et d’erreur.

## Client de proxy préparé

Le module `src/api/proxyClient.ts` fournit :

```ts
analyzeDocumentMap(pdfBytes, filename, signal)
extractQuestions(pdfBytes, filename, context, signal)
```

Il envoie le PDF comme corps HTTP brut `application/pdf`, omet les cookies et n’accepte
aucun modèle ni prompt venant du navigateur. L’URL de base est configurée par :

```bash
VITE_QCM_API_BASE_URL=/api
```

Pour un développement séparé :

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

Une construction peut être produite ultérieurement avec `npm run build`, mais aucun dossier
`dist` n’est inclus dans l’archive de phase 2.

## Confidentialité

Avant la phase 3, le PDF n’est envoyé nulle part par l’interface. Lorsque le client de proxy
sera connecté, le transfert ne se fera qu’après une action explicite de l’utilisateur vers
les endpoints PHP configurés. Aucun usage de `localStorage`, IndexedDB, cookie applicatif ou
compte utilisateur n’est prévu.
