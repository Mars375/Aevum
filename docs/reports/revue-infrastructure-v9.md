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

**1. Un appel distant valide n'est pas un taux — mesuré : 7 sur 10.** Les trois
graines du rapport affichent `rejected: 0`, mais elles sont jouées par
`localCouncil`, qui n'émettait déjà pas d'ordres invalides. C'est le piège du
point 3 de CLAUDE.md sous une autre forme : _servi ≠ a répondu_ devient ici
_zéro rejet local ≠ zéro rejet réel_. La preuve distante du lot valait un appel.
J'ai refait le même protocole sur les cinq graines qui construisent réellement
(`scripts/v9-remote-series-probe.ts`, rapport
`docs/reports/v9-remote-series.json`) : chauffe locale gratuite, puis un conseil
distant par graine, avec la correction bornée que le moteur accorde déjà — soit
cinq conseils et entre cinq et dix appels modèle réels.

|                                               |                           |
| --------------------------------------------- | ------------------------- |
| conseils demandés, premier tirage             | 5 (graines 42/7/1/17/314) |
| **servis par le modèle lui-même**             | **4 sur 5** (80 %)        |
| repli silencieux par une politique locale     | **0**                     |
| **conseils valides, zéro ordre rejeté**       | **3 sur 5** (60 %)        |
| ayant effectivement choisi une infrastructure | 3 sur 5                   |

Le point capital tient : **aucune substitution silencieuse**. La graine qui
échoue est rapportée `unavailable`, jamais remplacée par un dirigeant local.

**Puis un second tirage a réfuté le taux que je venais d'écrire.** Mêmes cinq
graines, mêmes ticks, quelques minutes plus tard : **5/5 servis** et **4/5
valides**, là où le premier donnait 4/5 et 3/5. La validité d'un conseil n'est
donc pas une propriété de la graine — la graine 1 a échoué au schéma, puis rendu
un JSON illisible, puis réussi, sur trois exécutions du même tick. Ce qu'on peut
affirmer, c'est l'agrégat des deux tirages :

|                                        |                 |
| -------------------------------------- | --------------- |
| conseils distants demandés (2 tirages) | 10              |
| servis par le modèle lui-même          | **9/10 (90 %)** |
| valides, zéro ordre rejeté             | **7/10 (70 %)** |

90 % passe largement la barre des 70 % de CLAUDE.md : `longcat-2.0` est
classable. Et la leçon de méthode vaut pour la suite — **un `valid: true`
unique, comme celui du lot, ne mesure rien ; il faut répéter le même tick.**

Les deux échecs restants disent deux choses différentes :

- **Un conseil entier jeté pour un champ facultatif — corrigé.** Au premier
  tirage, `plan.targetTech` portait une valeur hors énumération et toute la
  décision était refusée au schéma, correction comprise, alors que ses ordres
  étaient légaux. Le point 5 de CLAUDE.md dit l'inverse : « un champ absent,
  `null`, ou dans une autre forme, n'est pas une erreur… plutôt que de jeter une
  bonne décision pour une question de forme ». Le plan est désormais **retiré**
  — et non mis à `null`, qui annulerait le plan en cours, une décision que le
  dirigeant n'a pas prise. Seules les anomalies situées dans `plan` sont
  pardonnées ; un ordre malformé coule toujours la réponse. **Honnêteté sur la
  preuve** : l'erreur de schéma n'est pas réapparue dans les tirages suivants,
  donc la correction est démontrée par test unitaire, pas sur le terrain.
- **Graine 17 — le modèle choisit hors de ce qu'on lui annonce.** Elle échoue
  aux deux tirages, sur une cible de plan de fondation, avec deux motifs
  différents (« Aucun colon ne peut atteindre ce site », puis « Le site est
  occupé ou trop proche d'une ville »). On pourrait croire que
  `settlementPlanSites` annonce des sites que le validateur refuse. Vérifié, et
  c'est faux : `foundationTiles` applique exactement les règles de `planIssue`.
  J'en ai fait une garde exécutable (`advertised-plan-sites.test.ts`) plutôt
  qu'une lecture. Le refus vient donc du modèle, qui sort de ses options
  annoncées — et le moteur a raison de le refuser. C'est le contrat qui
  fonctionne, pas un défaut.

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
**descente**. Une campagne ne suffisait pas à le dire, alors j'ai élargi à douze
graines en simulation locale (`scripts/infrastructure-seeds-probe.ts`) :
**quatre graines atteignent le plafond, aucune n'en redescend.** Une seule
graine (314) reste en régime intermédiaire durable, à 13.

La règle n'est pourtant pas bloquante : `+2 × utilisation − 1` décroît dès que
l'utilisation passe sous 0,5, c'est-à-dire dès que le solaire couvre la moitié
de la demande fossile. Le levier existe donc et personne ne s'en sert — ce qui
est **un résultat sur les dirigeants, pas un défaut du moteur**, et à ce titre
exactement ce que le projet cherche à observer. La question reste ouverte pour
un modèle distant, qui pourrait voir le levier que la politique locale ignore.

**3. Treize sites ne sont pas treize observations — et douze graines le
confirment.** Mesure locale sur douze graines :

|                                             |                                 |
| ------------------------------------------- | ------------------------------- |
| graines qui construisent au moins un site   | **5 sur 12**                    |
| sites au total                              | 92                              |
| part de la civilisation dominante (médiane) | **83,3 %** (min 29,4, max 92,3) |
| premier site le plus précoce                | action 617 sur 1 200            |
| ordres rejetés, toutes graines confondues   | 0                               |

Le système est donc **tardif et concentré** : il ne s'allume jamais avant le
dernier tiers d'une campagne, sept graines sur douze ne le déclenchent pas du
tout, et quand il se déclenche une seule civilisation emporte typiquement plus
de quatre sites sur cinq. Ce n'est pas un défaut du lot — c'est la forme réelle
du phénomène, et elle dit qu'une comparaison de modèles sur l'usage des
infrastructures demanderait beaucoup de graines avant de dépasser le bruit de
plateau documenté dans `board-noise.md`.

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

## Un défaut trouvé en chemin, hors du lot v9

En vérifiant comment le lecteur se comporte quand un fichier n'est pas servi,
j'ai trouvé le piège que `CLAUDE.md` décrit — appliqué à moitié. `try_files`
renvoie la page de l'application en **200 avec du HTML** pour un JSON absent :
`res.ok` est vrai et c'est `res.json()` qui échoue. `replay-loading.ts` portait
déjà la parade (`NotServed`, qui teste le type déclaré puis le premier
caractère), mais **seules les batailles s'en servaient**. Un monde absent
arrivait donc au lecteur sous la forme :

> Impossible de charger worlds/…json — Unexpected token '<'

On annonce un fichier corrompu pour une simple absence, sur la page même que
l'hébergeur statique est censé servir. La garde est maintenant partagée
(`fetchServedJson`) et le chargement de monde la traverse ; l'absence est
nommée comme une absence. Deux tests l'attestent.

## Suites données

- Point 4 corrigé dans `packages/world/src/infrastructure.ts`, test ajouté.
- Trou de garde comblé : `packages/metrics` entre enfin dans le contrôle de
  non-déterminisme et dans l'interdiction d'importer le lecteur
  (`boundaries.test.ts`), et le paragraphe de `CLAUDE.md` qui décrivait ce trou
  est à jour.
- Quatre sondes ajoutées. Trois sont locales et ne coûtent rien :
  `options-narrowing-probe.ts`, `pollution-regime-probe.ts` et
  `infrastructure-seeds-probe.ts`. La quatrième,
  `v9-remote-series-probe.ts`, chauffe en local et ne demande qu'un conseil
  distant par graine ; elle écrit son propre rapport et n'écrase jamais
  `infrastructure-verification.json`.
- Points 2 et 3 mesurés sur douze graines ; point 1 sur dix conseils distants,
  en deux tirages, parce que le premier ne suffisait pas.
- Point 1 corrigé dans `packages/agents/src/council.ts` : un plan malformé ne
  coûte plus le conseil entier. Garde ajoutée sur les sites de fondation
  annoncés (`advertised-plan-sites.test.ts`).
- Défaut hors lot corrigé : la garde « pas servi » du lecteur couvre enfin les
  mondes et plus seulement les batailles.
- **Reste ouvert, et c'est une décision, pas du code** : tolérer un champ de
  plan malformé plutôt que de jeter le conseil entier (point 1, graine 1) ;
  décider si le plafond de pollution doit rester absorbant en pratique
  (point 2) ; faire dire à `docs/infrastructure-v9-design.md` §8 quel mécanisme
  garantit le rejeu (point 5).

## Limites de cette revue

Aucun contrôle visuel du rendu 3D ni du panneau — l'aperçu PNG n'a pas été
inspecté — et aucune vérification de la publication. Les mesures locales sont
conduites par `localCouncil` : elles décrivent ce que fait la politique locale,
pas ce que ferait un modèle. La série distante porte sur cinq graines et un seul
modèle (`longcat-2.0` via Nous) ; elle ne dit rien des trois autres dirigeants
ni d'une campagne distante longue, qui reste non prouvée.
