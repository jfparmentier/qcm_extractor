# Frontend — Phase 3.2

L’application React/TypeScript charge et affiche localement un PDF, puis lance une cartographie LLM asynchrone.

## Fonctionnement

- envoi explicite du PDF à `analyze-map.php` ;
- réception d’un jeton de suivi signé ;
- interrogation périodique de `mapping-status.php` ;
- annulation via `mapping-cancel.php` ;
- affichage des états d’envoi, de file d’attente et d’analyse ;
- validation AJV du résultat ;
- navigation et superposition des régions détectées.

Le jeton est transmis par l’en-tête `X-QCM-Job`, jamais dans l’URL. Le PDF et le résultat restent en mémoire dans l’onglet.

## Exécution

```bash
npm install
npm run typecheck
npm run dev
```

Pour un proxy séparé :

```bash
VITE_QCM_API_BASE_URL=http://127.0.0.1:8081 npm run dev
```

## Éditeur géométrique

La cartographie validée est enrichie en mémoire avec un identifiant local par région. Le composant `PdfPageCanvas` gère les interactions Pointer Events pour déplacer, redimensionner et tracer les zones. Le reducer conserve les modifications sans persistance serveur.
