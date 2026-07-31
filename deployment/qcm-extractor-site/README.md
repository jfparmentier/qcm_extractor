# Dossier prêt pour OVH Hosting Perso et MAMP — Phase 3.1.0

## Installation

1. Renseigner la clé dans `private/config/runtime.php`.
2. Copier ce dossier complet dans MAMP ou sur OVH.
3. Définir `public` comme racine web.
4. Redémarrer Apache sous MAMP.
5. Vérifier `public/api/diagnostic.php`.

## Documents longs

La cartographie est exécutée en arrière-plan auprès du fournisseur. L’interface démarre la tâche, interroge son état toutes les deux secondes, puis récupère le JSON final. Les limitations de connexion de 30 ou 120 secondes ne s’appliquent donc plus à la durée totale du raisonnement.

Le proxy ne stocke ni PDF ni résultat de tâche. Un jeton signé et temporaire permet le suivi. Le fournisseur conserve temporairement l’état de réponse nécessaire à ce mode asynchrone.

## Journal

```text
private/runtime/logs/qcm-proxy.log
```

Les événements `background_job_started`, `background_job_completed` et `background_job_cancelled` permettent de vérifier le déroulement sans exposer de contenu sensible.
