# Frontend — Phase 7.1.1

Application React/TypeScript exécutée dans le navigateur. Elle charge le PDF localement, gère la cartographie et les zones, crée les sous-PDF avec `pdf-lib`, orchestre la seconde passe d’extraction et fusionne les réponses validées.

```bash
npm install
npm run typecheck
npm run build
```

Le dossier `frontend/dist` n’est pas inclus dans cette livraison. Le dossier portable préconstruit se trouve sous `deployment/qcm-extractor-site/public`.


## Révision question par question

La phase 7 ajoute `QuestionReview.tsx` et `domain/review.ts`. Les brouillons édités restent en mémoire. Une question modifiée redevient automatiquement non validée. L’export ZIP n’est activé que lorsque toutes les questions sont valides et explicitement validées. L’archive contient `questions.json` et les PNG sous `assets/`.

La révision est verrouillée jusqu’à la génération de toutes les illustrations attendues. Le schéma d’extraction impose également un feedback pédagogique non vide pour chaque question.
