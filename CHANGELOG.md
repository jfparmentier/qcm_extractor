# Journal des modifications

## 7.0.0 — Révision question par question

- ajout d’un onglet « Révision » disponible après la seconde passe d’extraction ;
- affichage d’une seule question à la fois avec navigation précédente et suivante ;
- disposition en deux colonnes : PDF source à gauche et contenu éditable à droite ;
- sélection des pages sources et superposition non modifiable des zones de la question ;
- édition du type, du titre, de l’énoncé, des propositions, des réponses correctes et du feedback ;
- ajout, suppression et réordonnancement des propositions ;
- aperçu des illustrations générées associées à la question ;
- validation explicite de chaque question avec contrôles de cohérence ;
- export JSON disponible sur la dernière question lorsque toutes les questions sont validées ;
- remplacement des jetons d’illustration par des références Markdown vers `assets/` dans l’export ;
- mise à jour du dossier portable OVH/MAMP sans création de `frontend/dist`.

## 6.0.0 — Extraction et correction déterministe des illustrations

- ajout d’un onglet « Images » après la seconde passe d’extraction ;
- utilisation exclusive des zones `essential_image` et `decorative_image` définies dans la cartographie ;
- rendu local haute résolution des pages avec réutilisation d’un même rendu pour plusieurs zones ;
- découpe exacte des boîtes englobantes normalisées et génération de PNG avec fond blanc ;
- association aux questions, textes alternatifs et jetons d’insertion issus de l’extraction ;
- aperçu, dimensions, taille, téléchargement individuel et régénération locale ;
- génération globale annulable et nettoyage systématique des URL objet ;
- avertissements pour les zones trop petites, les métadonnées non associées et les images décrites sans zone ;
- absence volontaire de retouche géométrique et de remplacement par un fichier local dans l’onglet Images ;
- mise à jour du dossier portable OVH/MAMP sans création de `frontend/dist`.

## 5.0.1 — Correctif de compatibilité AJV strictTypes

- ajout des types explicites dans les sous-schémas conditionnels utilisant `maxItems`, `minItems`, `maxLength` et `properties` ;
- correction du schéma d’extraction chargé au démarrage de l’interface ;
- correction préventive des schémas d’export et du corpus de référence ;
- ajout d’un test de non-régression vérifiant la compatibilité avec le mode strict d’AJV ;
- mise à jour du dossier portable OVH/MAMP sans création de `frontend/dist`.

## 5.0.0 — Seconde passe d’extraction

- extraction asynchrone de chaque sous-PDF par l’endpoint métier `extract-questions.php` ;
- ajout des endpoints de suivi et d’annulation de l’extraction ;
- transmission d’un contexte de lot compact, validé côté serveur et dépourvu d’instructions libres ;
- file d’exécution frontend avec un à trois lots simultanés ;
- reprises automatiques configurables pour les erreurs temporaires ;
- validation AJV, normalisation des pages et contrôle des réponses correctes ;
- détection des segments manquants, dupliqués ou inattendus ;
- fusion ordonnée des questions et réécriture des identifiants globaux ;
- aperçu des résultats et navigation vers les segments sources ;
- quotas distincts pour la cartographie et les multiples appels d’extraction ;
- mise à jour du dossier portable OVH/MAMP, sans création de `frontend/dist`.

## 4.0.0 — Découpage local et gestion des lots

- ajout de `pdf-lib` pour copier localement des pages du PDF sans passage par le serveur ;
- planification configurable par nombre de questions, nombre de pages, taille estimée, pages de contexte et écart maximal ;
- regroupement des segments voisins et détection des lots hors limites ;
- conservation de la correspondance entre pages locales et pages originales ;
- génération séquentielle d’un lot ou de tous les sous-PDF ;
- téléchargement individuel des sous-PDF générés ;
- conservation des fichiers uniquement en mémoire dans le navigateur ;
- ajout d’un onglet « Lots » et des tests de non-régression de phase 4.

## 3.2.0 — Éditeur géométrique des zones

- déplacement des zones par glisser-déposer directement sur le PDF ;
- redimensionnement au moyen de huit poignées ;
- ajout de zones par tracé à la souris ou au doigt ;
- suppression des zones sélectionnées depuis le panneau ou avec la touche Suppr ;
- modification du rôle d’une zone ;
- identification locale stable des régions et indication des zones modifiées par l’utilisateur ;
- conservation des corrections uniquement en mémoire, sans stockage serveur ;
- mise à jour du dossier OVH/MAMP et des tests de non-régression.

## 3.1.2 — Visualiseur sans colonne de miniatures

- suppression de la colonne gauche contenant les miniatures de toutes les pages ;
- conservation de la navigation par numéro de page et boutons précédent/suivant dans la barre d’outils ;
- agrandissement de l’espace disponible pour la page PDF ;
- adaptation du mode cartographie à une disposition en deux colonnes : document et résultats.

## 3.1.1 — Quota local distinct pour MAMP

- identification stricte des requêtes locales par l’adresse de boucle locale et le nom d’hôte ;
- limite locale configurable avec `QCM_RATE_LIMIT_LOCAL_REQUESTS`, fixée à 100 par défaut ;
- maintien de la limite publique à 10 démarrages d’analyse par heure et par adresse IP ;
- séparation des clés de compteur locales et publiques ;
- ajout des paramètres de limitation au diagnostic ;
- message 429 enrichi avec une estimation du délai avant réinitialisation ;
- confirmation que les interrogations de statut et les annulations ne consomment pas le quota.

## 3.1.0 — Cartographie asynchrone des documents longs

- lancement de la première passe avec `background: true` ;
- ajout de `mapping-status.php` pour interroger l’état de la réponse ;
- ajout de `mapping-cancel.php` pour annuler une analyse ;
- remplacement de la connexion PHP longue par des requêtes courtes de démarrage et d’interrogation ;
- ajout d’un jeton de suivi signé, sans base de données ni stockage de tâche local ;
- transmission du jeton par `X-QCM-Job`, hors des URL et des journaux d’accès ;
- affichage des états `uploading`, `queued` et `in_progress` dans l’interface ;
- conservation de `store: false` et absence d’utilisation de `/v1/files` ;
- ajout des paramètres de délais et d’intervalle de suivi ;
- mise à jour des tests, de la documentation et du dossier OVH/MAMP.

## 3.0.3 — Diagnostic MAMP et robustesse du proxy

- contrôle de la valeur **effective** de `max_execution_time` avant l’appel au LLM ;
- ajout de `.user.ini` et de directives conditionnelles `mod_php` pour MAMP ;
- ajout de l’endpoint non sensible `public/api/diagnostic.php` ;
- ajout d’un journal technique privé dans `private/runtime/logs/qcm-proxy.log` ;
- conservation des réponses JSON même en cas d’échec d’initialisation PHP ;
- affichage dans l’interface du type MIME et d’un extrait de la réponse HTTP illisible ;
- distinction des erreurs cURL : délai, TLS et connexion ;
- journalisation du statut HTTP fournisseur et de son code d’erreur, sans PDF, prompt ni clé ;
- utilisation de HTTP/1.1 pour l’appel cURL et suppression de l’attente `Expect: 100-continue` ;
- modèle de cartographie par défaut remplacé par `gpt-5-mini` ;
- effort de raisonnement de cartographie réglé sur `low` et verbosité sur `low` ;
- délai fournisseur réglé à 120 s et plafond PHP à 150 s ;
- ajout du code `PHP_TIME_LIMIT_TOO_LOW` lorsque MAMP refuse la modification du délai ;
- mise à jour des tests et de la documentation.

## 3.0.1 — Correctif de transmission du PDF

- transmission du PDF incorporé sous forme de data URL `data:application/pdf;base64,...`.

## 3.0.0 — Phase 3 : première passe de cartographie

- connexion du bouton de cartographie à l’endpoint PHP `analyze-map.php` ;
- ajout des états en cours, terminé, erreur et annulation ;
- validation de la réponse par AJV avec le schéma JSON 2020-12 ;
- ajout de contrôles déterministes sur les pages, identifiants et boîtes englobantes ;
- normalisation contrôlée des coordonnées et détection des segments fortement superposés ;
- ajout d’un panneau listant les questions, pages, types, avertissements et scores de confiance ;
- ajout des superpositions interactives sur les pages PDF ;
- ajout de la navigation entre la liste des segments et le document ;
- affichage du modèle et de la consommation de jetons ;
- ajout de l’annulation avec `AbortController` et de la relance après erreur ;
- mise à jour du dossier de déploiement OVH/MAMP sans créer `frontend/dist` ;
- ajout des tests et de la documentation de phase 3.

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
