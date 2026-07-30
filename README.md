# Phase 0 — Spécification du format QCM

Cette archive contient les contrats de données du MVP et un corpus de référence manuel de 20 questions provenant des deux PDF fournis.

## Contenu

- `schemas/mapping.schema.json` : sortie de la première passe, consacrée à la cartographie des questions et des régions de pages.
- `schemas/extraction.schema.json` : sortie de la seconde passe, consacrée à l’extraction détaillée des QCM.
- `schemas/export.schema.json` : format final des questions validées et des ressources exportées.
- `schemas/golden-dataset.schema.json` : schéma du corpus de référence.
- `golden/golden-dataset.json` : 20 cas manuellement normalisés, soit 10 cas de physique et 10 cas de mathématiques.
- `examples/` : exemples valides pour chaque contrat, dont un cas synthétique à réponses multiples.
- `tests/validate.py` : validation structurelle de tous les fichiers JSON et contrôles métier complémentaires.

## Décisions de format

### Types de questions du MVP

- `single_choice` : zéro ou une réponse correcte pendant l’extraction ; une seule réponse correcte au maximum.
- `multiple_choice` : plusieurs réponses correctes possibles.
- `true_false` : exactement deux propositions normalisées en `True/False` ou `Vrai/Faux`.

Le corpus fourni ne contient pas de cas incontestable où plusieurs options doivent être cochées simultanément. Le support de `multiple_choice` est donc illustré par un exemple synthétique.

### Contenu textuel

Le format canonique est `markdown-latex` :

- mathématiques en ligne : `\( ... \)` ;
- mathématiques en bloc : `\[ ... \]` ;
- images provisoires dans la seconde passe : `![texte alternatif](asset:identifiant)` ;
- images finales dans l’export : chemins relatifs tels que `assets/question-1.png`.

Le HTML n’est pas une source canonique. Il doit être généré et assaini uniquement pour l’affichage.

### Coordonnées des régions

Les boîtes englobantes utilisent des coordonnées normalisées :

- origine : coin supérieur gauche de la page ;
- `x`, `y`, `width`, `height` : nombres entre 0 et 1 ;
- numérotation des pages : base 1, identique à la pagination PDF.

Les contraintes `x + width <= 1` et `y + height <= 1` sont contrôlées par le code applicatif, car JSON Schema ne permet pas d’exprimer directement cette somme.

### Provenance

Les réponses correctes utilisent :

- `explicit_in_document` ;
- `inferred_by_model` ;
- `provided_by_user` ;
- `not_available`.

Les titres et feedbacks utilisent :

- `explicit_in_document` ;
- `generated_by_model` ;
- `provided_by_user` ;
- `not_available`.

Une réponse absente du document doit rester vide avec la provenance `not_available`. Le modèle ne doit pas présenter une résolution personnelle comme une réponse explicitement lue.

### Images

- `essential` : nécessaire pour comprendre ou résoudre la question ;
- `decorative` : peut être omise sans perte sémantique.

Le corpus teste notamment une photographie décorative sur la diapositive 17 du document de physique. Elle ne doit pas être intégrée dans l’énoncé exporté.

## Règles métier à appliquer en plus du JSON Schema

1. Tous les identifiants de questions, segments, choix et ressources sont uniques dans leur portée.
2. Chaque identifiant de `correct_choice_ids` référence un choix existant.
3. Chaque ressource citée par `asset:...` existe dans `images`.
4. Chaque page référencée appartient au PDF source.
5. Les boîtes englobantes restent entièrement dans la page.
6. Les pages sont conservées dans l’ordre croissant.
7. Une question `single_choice` ne possède jamais plus d’une réponse correcte.
8. Une question dont la réponse est `not_available` possède une liste de réponses correctes vide.
9. Une question exportée possède `validation_status: validated`.
10. Les expressions LaTeX sont rendues dans l’interface avant validation humaine.

## Corpus de référence

Le fichier `golden-dataset.json` est volontairement un sous-ensemble, non une transcription exhaustive des PDF. Il couvre :

- une question par diapositive ;
- plusieurs questions par page ;
- questions coupées par un saut de page ;
- vrai/faux ;
- équations, indices, fractions, systèmes et déterminants ;
- figures vectorielles, graphiques colorés et illustrations décoratives ;
- options en colonnes ;
- réponse et feedback explicites ;
- absence explicite de réponse dans le document source.

Les boîtes englobantes ont été estimées manuellement à des fins de test fonctionnel. Elles constituent des zones attendues raisonnables et non une annotation pixel-par-pixel.

## Validation

Depuis la racine de l’archive :

```bash
python tests/validate.py
```

Le script requiert Python 3 et le paquet `jsonschema`.
