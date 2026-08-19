# Règles de bataille — ruleset `v2`

Statut : spécifié · Date : 2026-08-18 · Tâche kanban : `t_a5441071`

Le ruleset v1 (`rules.md`) reste la source de vérité des replays `v1` et n'est
pas modifié. Le v2 l'étend ; les deux coexistent et le moteur choisit d'après le
champ `rulesetVersion` du manifest. Un replay v1 doit rester lisible pour
toujours.

## Ce que v2 ajoute

| Mécanique | v1 | v2 |
| --- | --- | --- |
| Composition d'armée | imposée, 1 MELEE + 1 RANGED | **achetée sur un budget de 20 points** |
| Visibilité | totale | **brouillard de guerre, par rayon de vision** |
| Diplomatie | aucune | **propositions bornées, alliances, capitulation** |
| Mémoire du général | aucune | **résumé compact des tours passés** |
| Victoire | dernière faction debout | **+ victoire d'alliance, + capitulation** |

## 1. Composition d'armée

Chaque faction dispose de **20 points** et compose librement, dans la limite de
**4 escouades**.

| Archétype | Coût | PV | Déplacement | Portée | Dégâts | Vision |
| --- | --- | --- | --- | --- | --- | --- |
| `MELEE` | 6 | 10 | 2 | 1 | 4 | 4 |
| `RANGED` | 7 | 8 | 1 | 4 | 3 | 6 |
| `SCOUT` | 4 | 6 | 3 | 1 | 2 | **9** |
| `HEAVY` | 10 | 16 | 1 | 1 | 6 | 3 |

`SCOUT` et `HEAVY` sont nouveaux en v2. Le scout ne se bat quasiment pas : il
voit. Le heavy voit très mal mais encaisse.

Une composition est **légale** si son coût total est ≤ 20, si elle compte entre
1 et 4 escouades, et si elle contient au moins une escouade capable d'infliger
des dégâts. Une composition illégale est **rejetée et remplacée par la
composition par défaut** (1 MELEE + 1 RANGED + 1 SCOUT = 17 points), avec un
événement `COMPOSITION_REJECTED` portant le motif. Le moteur ne « corrige »
jamais une composition pour la rendre valide.

Le déploiement reste symétrique : les escouades d'une faction sont posées dans
son coin, en ordre canonique d'`id`, sur des tuiles fixes.

## 2. Brouillard de guerre

Une escouade ennemie est visible pour une faction si **au moins une** de ses
escouades vivantes est à une distance de Chebyshev ≤ à sa vision.

La `LocalView` v2 porte donc trois listes au lieu de deux :

- `yourSquads` — toujours toutes, avec leurs positions exactes ;
- `visibleEnemies` — position et PV exacts ;
- `rememberedEnemies` — **dernière position connue** d'un ennemi vu à un tour
  précédent et perdu de vue depuis, avec le numéro du tour de l'observation.

Le souvenir est ce qui rend le brouillard jouable plutôt que frustrant : un
général sait qu'une escouade *était* là, et peut se tromper.

Les alliés sont toujours visibles entre eux, **et partagent leur vision** :
c'est le premier bénéfice concret d'une alliance.

Le brouillard ne change **rien** au moteur de résolution. Il est entièrement
contenu dans la projection `localViewFor`, exactement comme le prévoyait le
document d'architecture v1. Les ordres restent résolus sur l'état réel — un
général peut donc attaquer une tuile vide parce qu'il visait un souvenir.

## 3. Diplomatie bornée

Chaque général peut joindre à ses ordres **au plus une action diplomatique par
tour**. C'est la borne : pas de négociation libre, pas de fil de discussion.

| Action | Effet |
| --- | --- |
| `PROPOSE_ALLIANCE` vers une faction | Enregistre une proposition valable **3 tours** |
| `ACCEPT_ALLIANCE` vers une faction | Si une proposition de cette faction est en cours, l'alliance prend effet **immédiatement** |
| `BREAK_ALLIANCE` vers une faction | Rompt l'alliance à la **fin du tour suivant** — une trahison ne peut pas être instantanée |
| `SURRENDER` | La faction capitule, ses escouades sont retirées |

Le délai de rupture est la règle qui donne son poids à une alliance : trahir
coûte un tour pendant lequel l'allié sait et peut réagir.

**Renouvellement.** Une proposition adressée à un partenaire dont la rupture est
déjà annoncée est acceptée comme une offre de renouvellement, et non rejetée en
`ALREADY_ALLIED`. Sans cette exception, le tour où une trahison prend effet est
exactement celui où la réconciliation est impossible — la proposition est
refusée parce que la rupture n'a pas encore eu lieu, et au tour suivant il n'y a
plus d'offre à accepter. Un tour mort que personne n'a demandé. La trahison
coûte toujours son tour : elle n'est pas annulée rétroactivement.

Effets d'une alliance active :

- les attaques entre alliés sont bloquées (`ATTACK_ALLY_BLOCKED`) ;
- les alliés partagent leur vision ;
- une victoire d'alliance est possible (§5).

Un message libre de 200 caractères maximum accompagne l'action et **n'a aucun
effet mécanique** — il est journalisé pour être lu dans le replay. C'est de la
mise en scène, pas une entrée du moteur, et c'est dit explicitement pour que
personne ne croie qu'un LLM peut négocier autre chose que les quatre verbes
ci-dessus.

## 4. Mémoire du général

Chaque général reçoit, avec sa vue, un **résumé compact** des tours écoulés,
borné à 8 entrées :

- le tour, ce qu'il a perdu, ce qu'il a détruit ;
- les changements diplomatiques le concernant.

Borné volontairement : le coût en tokens croît sinon avec la durée de la
bataille, ce que le guide de conception signalait comme le premier piège. Le
résumé est **produit par le moteur à partir des événements**, jamais par un
modèle — il ne peut donc pas halluciner un souvenir.

## 5. Conditions de victoire

Dans l'ordre d'évaluation :

1. **Annihilation** — aucune faction vivante : nul.
2. **Victoire solitaire** — une seule faction vivante.
3. **Victoire d'alliance** — toutes les factions vivantes sont mutuellement
   alliées, et elles sont au moins deux. La bataille s'arrête, l'alliance gagne
   **conjointement**. Aucun départage : le classement du tournoi compte une
   victoire partagée.
4. **Limite de tours** — départage par PV totaux, puis nombre d'escouades,
   puis **dégâts infligés**, puis nul.

   Le troisième critère n'était pas dans la spec initiale ; il vient d'une
   mesure. Sur 200 batailles scriptées, **16 % se terminaient sur un nul** parce
   que PV et nombre d'escouades tombaient à égalité — une bataille qui n'apprend
   rien sur qui commandait le mieux. Départager à égalité de force par ce qui a
   été infligé fait tomber les nuls à **2 %**, et récompense l'agressivité qui
   n'a pas payé en éliminations plutôt que de la traiter comme équivalente à la
   passivité.

   Le critère est **v2 uniquement**. Le v1 conserve son départage à deux
   niveaux : le modifier relabelliserait des issues dans des replays déjà
   enregistrés, ce qui n'est pas un correctif d'équilibrage mais une réécriture
   du passé. Un test le vérifie.

   La raison de victoire **nomme le critère qui a réellement tranché**, pour
   qu'un lecteur voie qu'une bataille s'est jouée aux dégâts et non à la survie.

Une capitulation retire la faction sans la déclarer vaincue par une autre : elle
est simplement éliminée.

## 6. Anti-exploits ajoutés

| # | Situation | Traitement |
| --- | --- | --- |
| 12 | Composition hors budget, vide, ou > 4 escouades | Rejetée, composition par défaut, `COMPOSITION_REJECTED` |
| 13 | Composition sans escouade offensive | Idem |
| 14 | Plus d'une action diplomatique dans un tour | **La première compte**, les suivantes : `DIPLOMACY_REJECTED` |
| 15 | `ACCEPT_ALLIANCE` sans proposition en cours | Ignorée, `NO_SUCH_PROPOSAL` |
| 16 | Action diplomatique visant sa propre faction | Ignorée, `SELF_TARGETED` |
| 17 | Action visant une faction éliminée | Ignorée, `DEAD_FACTION` |
| 18 | `BREAK_ALLIANCE` sans alliance | Ignorée, `NOT_ALLIED` |
| 18b | `BREAK_ALLIANCE` répété pour avancer la date | Ignoré — la date d'effet ne bouge pas |
| 19 | Attaque sur un allié | Annulée, `ATTACK_ALLY_BLOCKED` |
| 20 | Message diplomatique démesuré | Tronqué à 200 caractères |

## 7. Invariants ajoutés

| Invariant | Énoncé |
| --- | --- |
| `I12` Budget | Aucune faction ne dépasse 20 points ni 4 escouades. |
| `I13` Symétrie du brouillard | Si A voit B, ce n'est pas nécessairement réciproque — mais la visibilité de A ne dépend que des positions et des visions, jamais de l'ordre des factions. |
| `I14` Le brouillard ne touche pas le moteur | À ordres identiques, la résolution est identique avec ou sans brouillard. La projection ne peut pas changer une bataille. |
| `I15` Réciprocité des alliances | Une alliance est toujours symétrique : jamais A allié de B sans B allié de A. |
| `I16` Trahison différée | Un `BREAK_ALLIANCE` n'a jamais d'effet dans le tour où il est donné. |
| `I17` Mémoire bornée | Le résumé transmis ne dépasse jamais 8 entrées, quelle que soit la durée. |
| `I18` Mémoire non hallucinée | Chaque entrée du résumé correspond à un événement réellement journalisé. |
| `I19` Terminaison v2 | Une bataille v2 s'arrête toujours, alliances et capitulations comprises. |
| `I20` Compatibilité | Un replay `v1` se rejoue à l'identique sous le moteur v2, départage compris. |
| `I21` Départage gradué | Les dégâts infligés ne départagent jamais deux factions séparables par leurs PV ou leur nombre d'escouades. |

`I20` est le plus important : il interdit de casser le passé pour avancer.
