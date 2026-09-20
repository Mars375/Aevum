# Revue du lot infrastructures v9 — `0d150a2` et `f79fcf3`

Revue en lecture seule, menée depuis un worktree isolé à `f79fcf3`, sans toucher
à l'arbre de travail du chantier. Elle porte sur les deux commits livrés et
fusionnés dans `main` : `0d150a2` (infrastructures localisées, énergie,
pollution) et `f79fcf3` (ordres IA ancrés dans les options réalisables).

Ce rapport contient autant d'hypothèses **réfutées** que de constats. C'est
voulu : trois défauts que je croyais tenir se sont effondrés à la vérification,
et les écrire évite qu'une session suivante refasse le même chemin.

## Ce qui tient

**La suite complète est verte.** 62 fichiers, 597 tests, 30,6 s, dans un
worktree neuf à `f79fcf3`. Les six échecs « environnementaux » que le journal
relevait depuis le 14 septembre — `aevum-release.test.ts` en `uv_os_get_passwd
ENOMEM`, plus un timeout flaky de `discovery` — **ne se reproduisent pas ici**.
Ils étaient liés au poste ou à la charge, pas au code ; la porte finale peut
être considérée franchie.

**W4 est réellement couvert.** Je suis parti en croyant l'inverse :
`fingerprint()` ne prend qu'un `World`, or l'état v9 vit sur
`SpectatorState.infrastructure`. Mais le rejeu de campagne ne passe pas par là —
`replayCampaign` compare un `stateSignature`, qui hache **l'état spectateur
complet** en JSON canonique, `sites`, `queues` et `pollution` compris. Une
divergence d'un seul site au rejeu lève `Rejeu incohérent au tour N`. Les
chiffres le confirment : `replayVerified: true` sur les trois graines, 13
archives rejouées, 0 échec.

**Aucun ordre illégal n'est réécrit.** `queueInfrastructure` renvoie un motif et
`resolveCouncil` le pousse dans `rejected` avec la ville, le type et la cause.
Six refus nommés, aucun repli silencieux.

**Les versions antérieures sont intactes.** Chaque liste de règles a été
étendue par ajout de `"spectator-9"`, jamais par remplacement ; le champ d'état
est optionnel et le `.refine` ne l'exige que sous v9. Deux tests le gardent
explicitement (`keeps spectator-8 campaigns free of infrastructure`, `keeps
spectator-8 options free of v9-only fields`).

**Le déterminisme est propre.** Ni horloge ni aléatoire dans
`infrastructure.ts` ; le test de frontières passe. La pollution fractionnaire ne
casse rien : `JSON.stringify` d'un flottant est exact au rejeu, et
`stateSignature` trie les clés, donc l'ordre d'insertion dans `pollution` est
sans effet.

## Trois hypothèses que j'ai poursuivies et qui sont fausses

**Le resserrement des options n'est pas une tutelle.** C'était mon soupçon
principal : `f79fcf3` cesse d'annoncer `move/explore/retreat` à une unité sans
case adjacente libre, alors que `unitPath` fait un BFS sur tout le plateau. Une
unité pouvait donc rester mobile tout en étant déclarée sans action. Mesuré sur
la campagne archivée `infrastructure-local-42`, rejouée intégralement
(`scripts/options-narrowing-probe.ts`) :

|                                                    |                                                       |
| -------------------------------------------------- | ----------------------------------------------------- |
| tours de conseil                                   | 1 041                                                 |
| tours-unité observés                               | 7 093                                                 |
| tours-unité avec `actions: []`                     | 96 (1,35 %)                                           |
| ... dont le moteur acceptait encore un déplacement | **0**                                                 |
| tours-colon                                        | 1 522                                                 |
| ... avec `settle` retiré                           | 435 (28,6 %), tous sans site de fondation atteignable |

Dans les 96 cas, `unitPath` ne trouvait **aucune** case atteignable sur tout le
plateau. Le conseil ne retire donc que des ordres que le moteur aurait rejetés.
Réserve honnête : cette campagne est conduite par des dirigeants locaux, qui
placent les unités dans leurs propres situations ; un modèle distant en
produirait d'autres.

**Une ville ne peut pas se retrouver hors de son propre réseau.** `borders.ts`
ligne 148 saisit une case frontalière sans exclure celles qui portent une ville
et sans toucher `simulation.cities[].owner` — ce qui aurait mis `city.owner` et
`board[position].owner` en désaccord, et fait sortir la ville de
`ownedComponents` en silence. Mais `borders.ts` n'est jamais appelé par le
spectateur ; les deux prises de ville du chemin v9 (`spectator.ts:789`,
`units.ts:273`) écrivent les deux propriétaires ensemble.

**Une ville ne peut pas être fondée sur une rivière**, donc le cas « ville sur
case exclue des composantes » n'existe pas : `commands.ts:174` refuse la
fondation sur `kind === "river"`, et les rivières ne sont tracées qu'à la
génération du plateau.

## Ce qui mérite une décision

**1. « Zéro rejet » vient de dirigeants locaux et ne prouve rien sur le
distant.** Les trois graines affichent `rejected: 0`, mais elles sont jouées par
`localCouncil`, qui n'émettait déjà pas d'ordres invalides. C'est le piège du
point 3 de CLAUDE.md sous une autre forme : _servi ≠ a répondu_ devient ici
_zéro rejet local ≠ zéro rejet réel_. La preuve distante est d'un seul appel —
tick 639, `longcat-2.0` servi par lui-même (`fallbackCount: 0`,
`servedByFallback: false`, 11,3 s), `valid: true`. La preuve de service est
exemplaire ; l'échantillon vaut 1. Le design le dit déjà honnêtement ; ce qui
manque pour trancher est une série sur plusieurs graines avec la part servie
affichée.

**2. La pollution monte lentement, puis n'est plus réversible.** Les états
finaux des trois graines sont tous extrêmes — 0 ou le plafond 80 — ce qui m'a
d'abord fait écrire que la mécanique était binaire. La trajectoire dit autre
chose, et je me corrige. Rejeu complet de `infrastructure-local-42`
(`scripts/pollution-regime-probe.ts`) :

|                                              |                                |
| -------------------------------------------- | ------------------------------ |
| observations ville-tour                      | 24 602                         |
| première pollution                           | tour 730                       |
| plafond atteint                              | tour 964 (**234 tours** après) |
| bandes basse / moyenne / haute peuplées      | 76 / 80 / 78 observations      |
| **retours sous le plafond après saturation** | **0** sur 77 tours restants    |
| villes jamais touchées                       | toutes sauf `city-amber`       |

Le gradient existe donc : 234 tours de montée, réparties assez également entre
les trois bandes intermédiaires. Ce qui manque n'est pas la montée, c'est la
**descente** — une fois à 80, la valeur n'en redescend jamais dans cette
campagne, alors que la règle `−1` par tour du propriétaire devrait la faire
reculer dès que le solaire couvre la demande. Deux lectures possibles : soit le
dirigeant n'a jamais posé le solaire qui l'aurait sauvé (et c'est un résultat,
pas un défaut), soit `utilisation` reste à 1 pour une raison structurelle. Le
départage demande une graine où le solaire arrive après la centrale — aucune des
trois ne l'offre.

Deuxième fait, indépendant : la mécanique est à peine exercée. Une seule ville
polluée sur 24 602 observations ville-tour, et rien avant le tour 730 sur 1 041.
Ce que trois relevés disent de la pollution est donc très mince.

**3. Treize sites ne sont pas treize observations.** La répartition est très
concentrée : graine 42, azure porte 11 sites sur 13 ; graine 7, crimson en porte
12 sur 13 ; graine 123, aucun site en 406 actions. Le système est exercé par une
civilisation dominante par graine, et pas du tout dans un cas sur trois. Cela
n'invalide rien du lot, mais toute mesure ultérieure comparant des modèles sur
l'usage des infrastructures se heurtera au bruit de plateau documenté dans
`board-noise.md`.

**4. Un repli mort qui paierait sans construire.** `queueInfrastructure` et les
deux `tick*` reçoivent un contexte construit à la volée :
`{ world, modernization: state.modernization, infrastructure: state.infrastructure }`.
À l'intérieur, `ctx.infrastructure ?? (ctx.infrastructure = emptyInfrastructure())`
assigne sur **l'objet temporaire**. Si `state.infrastructure` était un jour
`undefined`, `pay()` prélèverait le coût sur `civ.stock` — qui est partagé — et
la file partirait avec le contexte jeté : ressources dépensées, chantier
disparu, aucune erreur. Le cas est aujourd'hui inatteignable (le `.refine` du
schéma exige le champ sous v9, et `resolveCouncil` fait un `??=` de plus), mais
la ligne _ressemble_ à une protection alors qu'elle échouerait en silence.
**Corrigé** : un `records(ctx)` lève désormais plutôt que d'improviser un état,
avec un test qui vérifie que la réserve reste intacte.

**5. Le design pointait le mauvais mécanisme pour W4.** §8 écrivait
« Fingerprint et `verify` n'intègrent les nouveaux champs que pour v9 ». Or
`fingerprint()` n'est appelé que par les scripts du monde continu (`live.ts`,
`eras.ts`, `index-worlds.ts`, `season-report.ts`, `civilization-probe.ts`) et
jamais sur une campagne spectateur. **Déjà réécrit** par le chantier ; la
section ne nomme cependant toujours aucun mécanisme, et une session qui cherche
la garantie de rejeu n'a rien à suivre. Une mention de `stateSignature`
suffirait.

## Suites données

- Point 4 corrigé dans `packages/world/src/infrastructure.ts`, test ajouté.
- Trou de garde comblé : `packages/metrics` entre enfin dans le contrôle de
  non-déterminisme et dans l'interdiction d'importer le lecteur
  (`boundaries.test.ts`), et le paragraphe de `CLAUDE.md` qui décrivait ce trou
  est à jour.
- Deux sondes de mesure ajoutées, toutes deux en rejeu déterministe sans appel
  distant : `options-narrowing-probe.ts` et `pollution-regime-probe.ts`.
- Points 1, 2 et 3 restent ouverts : ils demandent des appels distants ou des
  graines supplémentaires, pas du code.

## Limites de cette revue

Lecture de code et rejeu déterministe uniquement. Aucun appel distant, aucun
contrôle visuel du rendu 3D ni du panneau (l'aperçu PNG n'a pas été inspecté),
aucune vérification de la publication. Les deux mesures portent sur la seule
campagne v9 archivée, `infrastructure-local-42`, conduite par des dirigeants
locaux : les graines 7 et 123 n'existent que dans le rapport de vérification,
pas sur disque.
