# Passation Aevum — 21 septembre 2026

> **État au 21 septembre 2026, après reprise.** Ce document est conservé tel
> qu'il a été écrit ; il n'était pas suivi par git et aurait disparu avec le
> dossier de travail. Deux de ses sections sont désormais **faites**, et une
> session qui les suivrait referait un travail livré :
>
> - **§5 Travail A — modèles civils** : raccordés. Le défaut des colons dessinés
>   en marchands était réel et est corrigé. Voir
>   `apps/player/src/three/world-projection.ts` et
>   `apps/player/test/civilian-projection.test.ts`.
> - **§6 Travail B — diplomatie v10** : livrée. Conception corrigée sur cinq
>   points, module, intégration moteur, contrat IA, panneau spectateur, sondes
>   locale et distante. Voir `docs/reports/diplomatie-v10.md`.
>
> Le reste — objectif produit, conventions, délégation, critères de fin — vaut
> toujours. `JOURNAL_PROJET.md` porte le détail daté.

**Le projet n'est pas terminé.** Ce fichier permet de reprendre le travail sans confondre code livré, modules préparés et intentions. Vérifier Git au démarrage : d'autres agents travaillent aussi sur ce dépôt.

## 1. Commencer ici

1. Lire `AGENTS.md`, la section actuelle de `JOURNAL_PROJET.md`, puis ce fichier.
2. Dans `F:\Projet\Aevum`, exécuter `git status -sb`, `git log -8 --oneline`, `git worktree list` et `git fetch origin`.
3. Comparer ces résultats au tableau ci-dessous. Préserver les modifications des autres agents ; examiner les divergences avant toute fusion.
4. Reprendre les **modèles civils à raccorder** et la **conception diplomatique à corriger**, sur leurs branches respectives.
5. Après chaque lot : journal, tests pertinents, revue, corrections, commit/push et fusion lorsque le résultat est validé.

Les autorisations de l'utilisateur couvrent la poursuite du projet et la synchronisation Git. Son choix explicite est **spectateur uniquement** ; le mode dieu viendra plus tard.

## 2. Objectif produit

Une simulation de civilisations dirigées par IA, agréable à regarder et simple à lancer :

- Un dirigeant joue son tour, donne des ordres réels à ses unités, puis passe la main ; déplacements limités par des points.
- Progression indépendante Bronze → Antiquité → Moyen Âge → Industrie → Moderne → Futur.
- Carte 3D, villes et unités reconnaissables, ordres visibles, décisions et conséquences lisibles.
- Économie, recherche, guerre, diplomatie avec engagements vérifiables, crises auxquelles on peut se préparer.
- Modèles IA par défaut utilisables, erreurs et provenance explicites, démonstration sans clé, sauvegarde/reprise.

La référence visuelle était l'ensemble de l'expérience Project Napoleon, pas une copie de ses couleurs ou de sa police. Le besoin est un observatoire immersif, pas seulement un tableau de statistiques.

## 3. Dépôt et espaces de travail

Dépôt distant : `Mars375/Aevum`.

| Emplacement / branche | État vérifié lors de la passation |
| --- | --- |
| `main` et `origin/main` | `b3c9328`, synchronisés. Contiennent v9, améliorations IA, revue et distribution autonome. |
| `F:\Projet\Aevum` — `codex/diplomatic-agreements` | Branche de reprise principale, basée sur `b3c9328`. Conception v10 et documentation ; aucun moteur v10 implémenté. Le commit de passation vient après cette base. |
| `F:\Projet\Aevum\.worktrees\civilian-ages` — `codex/civilian-age-models` | `f928768`, committé et poussé. Trois fichiers de modèles/tests, **pas encore raccordés au jeu ni fusionnés**. |
| `F:\Projet\Aevum-revue` — `codex/distribution-autonome` | Checkout d'un autre chantier, observé à `27e6492`. Ne pas le nettoyer ou modifier sans vérifier son propriétaire et son état. |

**Particularité du worktree civil :** son `node_modules` est une **jonction vers `F:\Projet\Aevum\node_modules`**. Réutiliser ces dépendances ; ne pas y lancer une réinstallation ou une suppression récursive. Un cache de tests déplacé est dans `.superpowers/dependency-cache`. `.worktrees/` est ignoré par Git.

Les workers de conception diplomatique et de modèles civils ont terminé. Aucune reprise ne doit compter sur eux comme processus encore actifs ; leurs fichiers sont la preuve du travail.

## 4. Ce qui est livré dans main

| Lot | Repères et preuves à consulter |
| --- | --- |
| Tours séquentiels et déplacements | `docs/sequential-turns.md`, moteur `packages/world/src/spectator.ts` et `commands.ts`. |
| Six âges, programmes nationaux, silhouettes des villes/soldats | `ages.ts`, `modernization.ts`, `apps/player/src/three/age-models.ts`. |
| Capacités militaires technologiques | `77f0f0a`, `packages/world/src/military.ts`. |
| Crises annoncées trois manches avant, bilan avant/après | `b880895`, `climate-report.ts`. Les variations de stocks ne sont pas attribuées au seul climat. |
| Six infrastructures, réseaux d'énergie, pollution, panneaux et modèles 3D | `0d150a2`, `infrastructure.ts`, `InfrastructurePanel.vue`, `docs/infrastructure-v9-design.md`. |
| Choix IA réalisables, plans et lecture plus robustes | `f79fcf3`, puis revue jusqu'à `0606039`, `9515a88`, `9d8a58b`. Préserver les correctifs ultérieurs, notamment la tolérance des plans malformés et la garde des sites annoncés. |
| Distribution autonome Windows | `a1fd307`, `27e6492`, `scripts/package-app.ts`, `docs/reports/distribution-autonome.md`. |

La version de règles effectivement livrée est **`spectator-9`**. Les replays anciens doivent conserver leur comportement. `stateSignature` et `replayCampaign` sont les mécanismes de vérification du spectateur.

### Validation : ce qui est prouvé et ce qui ne l'est pas

- Base récente : **619 tests et TypeScript réussis**, vérifiés dans le worktree isolé avec `npm test -- --maxWorkers=2`, avant les nouveaux modèles civils.
- Deux lancements très parallèles ont rencontré des délais de cinq secondes dans les audits de branding/inventaire. Le premier essai du worktree manquait aussi du chemin local de `tsx` ; la jonction a corrigé ce problème. Ne pas confondre ces échecs d'environnement avec une preuve de régression moteur.
- Nouveaux modèles civils : **9 tests ciblés** (civilian + age + infrastructure models) et TypeScript repassés par le coordinateur avant `f928768`. Pas de suite complète ni de contrôle visuel de leur future intégration.
- `docs/infrastructure-verification.json` : trois graines locales sans rejet, 26 sites au total, replays valides et un conseil Nous v9 valide.
- `docs/reports/v9-remote-series.json` : mesure distante plus large enregistrée sur cinq graines, **3 conseils valides sur 5**. Des correctifs ont suivi : lire aussi `docs/reports/revue-infrastructure-v9.md`. Ce n'est pas une campagne distante longue validée.
- La revue a mesuré la concentration des sites et le plafonnement de pollution sur douze graines. Relire ses points ouverts avant de changer l'équilibrage ; une simulation locale n'établit pas la qualité stratégique des modèles distants.
- Le navigateur contrôlé était indisponible (`Codex auth token is unavailable`) et l'inspection d'image n'était pas supportée. **Aucun contrôle visuel complet du site n'est revendiqué.**

## 5. Travail A — intégrer les modèles civils

Dans le worktree `civilian-ages`, le commit `f928768` contient :

- `apps/player/src/three/civilian-assets.ts` : métadonnées pures, 30 noms `civilian_{age}_{role}`.
- `apps/player/src/three/civilian-models.ts` : `civilianModel(age, role)` produit les pièces géométrie/matériau.
- `apps/player/test/civilian-models.test.ts` : bornes, valeurs finies, déterminisme des sommets/couleurs et silhouettes distinctes.

Rôles : `farmer`, `lumberjack`, `miner`, `merchant`, `settler`, pour les six âges. Humains/outils aux premiers âges, machines/véhicules ensuite, drones/rovers au futur.

**À faire :**

1. Relire les builders et leurs tests.
2. Raccorder les assets à `world-projection.ts` et au chargement de `world-scene.ts`. Préserver les vues sans contexte d'âge.
3. Vérifier le traitement des colons : le code historique les représente parfois avec l'asset marchand.
4. Garder les métadonnées séparées des imports Three.js. Le précédent couplage avait fait passer le bundle initial d'environ 280 à 491 Ko.
5. Tester projection sans mutation, choix âge/rôle, chargement/disposal, anciennes vues, puis contrôler le rendu si un outil visuel devient disponible.
6. Mettre à jour le journal et intégrer cette branche après revue. Les builders seuls ne constituent pas une livraison visuelle.

## 6. Travail B — diplomatie suivie, règles v10

`docs/diplomacy-v10-design.md` est **un brouillon de conception, pas une spécification validée ni une implémentation**.

Direction retenue : offres bilatérales, acceptation/refus explicites, pactes de non-agression limités dans le temps, échanges de ressources, confiance et ruptures visibles.

**Corriger ces points du brouillon avant de coder :**

- Il décrit actuellement un transfert à sens unique. Pour un véritable échange négocié, définir les deux contributions (`give` / `receive` ou équivalent), leur solvabilité et leur application atomique.
- « Refuser l'acceptation si une offre existe déjà » est contradictoire : accepter nécessite précisément une offre. Distinguer l'offre visée d'un pacte déjà actif.
- Préférer une référence à l'identifiant exact de l'offre pour accepter/refuser ; cible + type peuvent devenir ambigus lorsqu'une proposition est remplacée.
- Fixer l'ordre de paiement avec modernisation, infrastructures, constructions et recrutement. Tester les budgets partagés, sans double dépense.
- Préciser expiration, mort et guerre : aucune prime de fidélité à un pacte dissous pour décès ; aucune trahison lorsque la guerre a été refusée par les règles.
- Revoir la stratégie de traitement d'un champ `agreement` malformé à la lumière du correctif récent sur `plan`. Ne pas accepter silencieusement un engagement invalide.
- Il faudra réellement étendre les enums de campagne/état et les consommateurs à v10. `stateSignature` seul ne suffit pas. Rechercher les tests exacts de versions et les usages de `slice(-1)` qui interpréteraient « 10 » comme « 0 ».
- L'interface concrète reste à réaliser : propositions, engagements, échéances, ressources, confiance, événements récents. **Aucun bouton permettant au spectateur de gouverner.**

Découpage conseillé : module `agreements.ts` + tests, intégration moteur/contrats IA, panneau spectateur, puis sondes de replay et échantillon distant borné. Préserver les améliorations du serveur `AEVUM_PORT`, `AEVUM_DATA` et de reprise des verrous.

## 7. Lancement, paquet et données

Consulter `DEMARRER.md` et `package.json` pour les commandes actuelles :

```powershell
npm run launch
npm test -- --maxWorkers=2
npm run typecheck
npm run player:build
npm run verify-season-1
npm run package
```

- Service local habituel : `http://127.0.0.1:5174/`. Vérifier le processus réel avant de le redémarrer ; ne pas interrompre une campagne en cours.
- Démo avancée enregistrée localement : `?campaign=infrastructure-local-42` — 1 041 actions, 13 sites lors du dernier contrôle API. Les campagnes de `worlds/spectator` sont des données locales ignorées par Git ; ne pas supposer qu'un clone neuf les possède.
- Un prototype v9 antérieur a été conservé dans `worlds/spectator/drafts`. Ne pas le confondre avec une archive d'une version déjà livrée.
- `npm run package` produit `dist-app/`. **Ce dossier n'était pas présent dans le checkout principal lors de la passation** ; le manifeste était présent dans le checkout de revue. Reconstruire et vérifier le paquet depuis la source finale avant de le distribuer.
- Le paquet utilise `%LOCALAPPDATA%\Aevum` pour les données (`AEVUM_DATA`) et embarque Node. Il est **non signé** ; installateur et mises à jour automatiques ne sont pas livrés.
- La clé Nous est dans l'environnement Windows de l'utilisateur. Utiliser les helpers existants ; ne jamais afficher sa valeur, copier un `.env` dans le paquet ou l'exposer au client.

## 8. Délégation demandée par l'utilisateur

**Le coordinateur orchestre, contrôle et renvoie les défauts en correction ; les workers DeepSeek implémentent.**

Profil validé sur cette machine : `deepseek-v4-flash`, via `opencode-go`. Préférer les enfants CLI aux sous-agents natifs, dont le routage fournisseur avait posé problème.

```powershell
codex exec -p deepseek-v4-flash -C "F:\Projet\Aevum" "<tâche bornée>"
codex exec -p deepseek-v4-flash resume <session-id> "<suite précise>"
```

- Donner des fichiers possédés explicitement, rappeler la présence des autres agents, demander des preuves de tests et une réponse courte.
- Le profil enfant `workspace-write` a rencontré des refus Windows. Les exécutions réussies ont utilisé `--sandbox danger-full-access` sous les permissions accordées à cette session. Réévaluer les permissions de l'hôte avant de reproduire cette option ; rester dans les fichiers attribués.
- L'outil enfant `apply_patch` a échoué avec « incompatible payload ». Les workers ont écrit via `exec_command` et les API de fichiers UTF-8.
- PowerShell 5 : lire avec `-Encoding UTF8`. Des accents dans un script envoyé à Node via stdin ont été remplacés par `?` ; préférer `.NET WriteAllText` UTF-8 ou des échappements Unicode.
- Certains enfants se sont arrêtés au milieu de l'analyse avec un résultat final vide. Vérifier fichiers et processus avant de relancer ; reprendre la session avec une action très précise plutôt que recommencer l'exploration.
- Ne pas se fier à « terminé » : examiner le diff, lancer les contrôles appropriés, puis intégrer. Une déclaration de succès du worker n'est pas une preuve suffisante.

## 9. Critères de fin du projet

Reprendre la liste dans `docs/release-spectateur.md`, en la confrontant au code et aux rapports récents. En particulier :

- Accords diplomatiques effectivement exécutés, avec durée, coûts, rupture et effets de confiance.
- Modèles civils réellement raccordés et expérience 3D vérifiée ; lecture claire des ordres et conséquences.
- Compatibilité des replays, lancement/reprise, sauvegardes conservées et démo utilisable sans clé.
- Qualité distante mesurée sur plusieurs dirigeants et sur une durée utile, avec erreurs, latence et provenance affichées.
- Paquet final reconstruit, contrôlé et documenté ; limites de signature/installateur explicites.
- Journal actuel, branches sauvegardées, revues et validations consignées. **Ne pas déclarer le projet complet sur la seule base de tests unitaires verts.**
