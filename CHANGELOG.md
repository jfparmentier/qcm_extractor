# Journal des modifications

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
