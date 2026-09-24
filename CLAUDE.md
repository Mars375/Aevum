# Aevum — ce qu'une session doit savoir avant de toucher au code

Ce fichier existe pour une raison précise : **éviter qu'une session neuve
redécouvre, et surtout refasse, ce qui a déjà été mesuré.** Ce qui coûte cher à
retrouver n'est pas où se trouve une fonction — un `grep` le dit en une
seconde — c'est _pourquoi c'est ainsi_ et _ce qu'on a déjà essayé qui ne
marchait pas._

Garder ce fichier court est le but. S'il grossit, il ne sera plus lu.

## Ce que c'est

Des modèles de langage gouvernent quatre civilisations dans un monde qui ne
s'arrête pas. Un moteur déterministe fait tout le reste. Trois jeux de règles
coexistent : **v1** et **v2** sont des batailles tactiques, gelées ; **w8** est
le monde continu, et c'est là que le travail se fait. **w9** existe dans le code
et dans `docs/spec/world-w9.md` — il ajoute les charrues d'acier — mais un monde
neuf naît en w8 (`WORLD_VERSION`, dans `packages/world/src/state.ts`), et le
monde livré est en w8. w9 ne s'obtient qu'en le demandant.

Le partage qui commande tout : **le modèle décide, le moteur tranche.** Un ordre
illégal est rejeté et enregistré, jamais réécrit en silence. C'est ce qui rend
un rejeu auditable.

Le second, propre au monde : **le moteur tourne en continu et gratuitement ; un
modèle n'est consulté qu'aux points de décision.** Un appel par civilisation et
par tour épuiserait un quota quotidien en minutes.

## Les invariants qu'on ne casse pas

Les six du monde sont dans `docs/spec/world-w8.md`. Les deux qui se cassent le
plus facilement :

- **W4 — rejouer le journal reproduit l'état.** Il est tombé une fois, en
  silence : une décision différée était appliquée à l'année où la question avait
  été _posée_ et non répondue. Un monde se déclarait alors éteint pendant qu'un
  rejeu le montrait vivant. Corollaire appris depuis : W4 vaut **à l'intérieur
  d'une version**. Changer le comportement d'un jeu de règles déjà joué invalide
  ses enregistrements — un correctif qui fait émettre un événement de plus change
  `state.memory`, donc la signature. La prochaine évolution d'un jeu de règles
  livré prend un numéro, pas une correction en place.
- **Rien de non déterministe dans `engine` et `world`.** Pas d'horloge, pas de
  `Math.random`. Les saisons, les bandits et les catastrophes viennent d'un hash
  pur de `(seed, tick)`. `packages/contracts/test/boundaries.test.ts` le vérifie,
  ainsi que les frontières entre paquets.

## Le lecteur — la plus grosse zone du dépôt

`apps/player` fait 6 400 lignes sur 55 fichiers, plus que n'importe quel paquet.
Vue 3 et Vite, Three.js seulement pour la vue 3D, chargée à la demande.

**Deux racines, pas une.** `/` monte l'**observatoire** (`Spectator.vue`), qui
joue les campagnes par le serveur. Les **archives** (`App.vue`) n'existent que
derrière `?archive`, `?world=` ou `?replay=`, et leurs quatre vues se choisissent
par `mode=` : `chronique` (par défaut), `archives`, `regles`, `a-propos` —
`view-address.ts` fait foi. Ce paragraphe a longtemps dit `?view=` et une seule
racine ; `qa:browser` ouvrait `/` et attendait la chronique, et il a cessé de
fonctionner sans témoin. `main.ts` ne charge **que** la racine montée :
l'observatoire porte une feuille globale, `spectator.css`, qui a déjà écrasé la
chronique quand les deux étaient importées ensemble.

Deux contrôles navigateur, à lancer après une retouche d'interface — les tests
ne voient ni un recouvrement ni un bouton caché : `npm run qa:browser` (lecteur
construit, Chrome trouvé seul, Windows compris) et `npm run qa:observatory`
(panneaux flottants mesurés à dix-huit largeurs, serveur lancé).

La décision qui compte : `vite.config.ts` aliase `@abs/world` vers les sources.
**Le lecteur recalcule le monde depuis son journal avec le code même qui l'a
vécu**, au lieu de faire confiance à un second rendu des événements. Un affichage
qui diverge du moteur serait un défaut qu'on ne verrait jamais ; ici il ne peut
pas exister.

**Les données arrivent par deux chemins, et il faut les distinguer.** Le lecteur
va chercher `worlds/index.json`, `worlds/status.json` et `replays/index.json` en
chemin relatif. Deux sources les fournissent :

- `apps/player/public/` est **suivi par git** et porte les deux mondes
  (`aevum-season-1`, `civilization-w10`), les quatre batailles de référence et
  les rapports, chacun avec son index. Tout part dans `dist` à chaque build —
  vérifié. C'est ce qui fait qu'un build statique a quelque chose à montrer.
- `docker-compose.yml` monte en plus `./worlds` et `./replays` en lecture seule
  par-dessus, délibérément, pour qu'un monde vivant se mette à jour sans
  reconstruire. La racine porte seize mondes ; un seul est publié.

Le seul absent d'un `vite build` est **`worlds/status.json`**, et c'est normal :
il décrit un monde qu'on entretient, pas une archive. L'état de veille reste donc
muet sur un hébergeur statique, et le `fetch` est gardé pour ce cas. Le mode
bataille, lui, **fonctionne** : les quatre entrées de `replays/index.json`
pointent vers des fichiers réellement livrés. Cette page a longtemps dit
l'inverse ; `apps/player/test/published-catalogue.test.ts` vérifie désormais que
chaque entrée des trois catalogues résout, pour que la réponse cesse de dépendre
d'une phrase écrite un jour dans un fichier.

Un piège de serveur à connaître : avec `try_files $uri $uri/ /index.html`, un
JSON absent revient en **200 avec du HTML**, pas en 404. `res.ok` est alors vrai
et c'est `res.json()` qui lève. La spec de refonte en fait un critère d'accep­
tation ; c'est la raison.

## Trois gardes à connaître avant d'éditer

**`packages/contracts/test/boundaries.test.ts`** applique la table du README au
lieu de la promettre : pas d'horloge ni d'aléatoire dans `engine`, `world` et
`metrics`, `contracts` n'importe personne, aucun paquet n'importe le lecteur,
aucune clé dans une source. Le trou qu'il avait est bouché : `packages/metrics`
ne figurait ni dans le contrôle de non-déterminisme ni dans celui qui interdit
d'importer le lecteur, et restait propre par vérification à la main — ce que ce
fichier existe précisément pour ne plus avoir à faire.

**Un seuil de version s'écrit une fois.** `SPECTATOR_RULES` et
`atLeast(règles, plancher)`, dans `packages/world/src/spectator.ts`, sont le seul
endroit où l'échelle s'énumère ; `boundaries.test.ts` refuse désormais toute
autre liste de deux `"spectator-N"` consécutifs. La raison : une garde recopiée
en clair **ne casse rien** quand une version paraît, elle **retire une capacité
en silence** à la nouvelle. Six l'avaient fait pour `spectator-10` — le rapport
climatique disparaissait, le bilan comptait des tours en les appelant des
manches, et le serveur consultait les quatre dirigeants au lieu du seul acteur,
soit quatre appels distants par tour au lieu d'un. Aucune n'a fait échouer un
test ; il a fallu ouvrir la page.

**`apps/player/test/branding.test.ts`** interdit l'ancien nom public hors d'une
liste blanche, comparée par `toEqual`. C'est une **égalité exacte**, donc elle
coupe des deux côtés : ajouter l'ancien nom quelque part la casse, et _le retirer
d'un fichier listé la casse aussi_ — il faut alors retirer le chemin de la liste.
Elle demande sa liste à `git ls-files`, donc **elle ne voit que ce qui est
suivi**. Ce n'était pas le cas au départ : elle parcourait l'arbre de travail
avec une liste d'exclusions, et n'importe quel fichier local la faisait tomber
au milieu d'un travail sans rapport — un cache d'outil, l'état d'un monde en
cours de veille. Chacun réclamait une exclusion de plus, et aucun n'était
publié. Demander la liste à git dit exactement ce que le test veut dire : ce
que le dépôt publie, c'est ce qu'il versionne.

## Ce qui a déjà été réfuté — ne pas refaire

1. **Un horizon long n'est pas une meilleure mesure.** Le bruit du plateau passe
   de 0,17 à 60 ans à 0,52 à 320. Mais un horizon court coupe la moitié
   intéressante : le plateau ne se remplit qu'à **l'an 148**, et guerres,
   capitales prises et extinctions arrivent après. Les deux effets sont réels et
   se contredisent — voir `docs/reports/board-noise.md`.
2. **Comparer des moyennes entre courses jette l'appariement.** Les quatre
   modèles partagent le même monde dans une course ; les comparer là supprime la
   variance du plateau. `npm run rank-eras` le fait.
3. **« Servi » ne veut pas dire « a répondu ».** Un modèle dont la chaîne de
   repli répond à sa place n'a pas gouverné. Toute mesure doit afficher la part
   servie par le modèle lui-même, et un modèle sous 70 % n'est pas classable.
4. **La consigne finale d'un prompt décide de ce que les modèles renvoient.**
   Trois champs sont revenus vides pour avoir manqué à cette liste, quelle que
   soit la qualité des explications au-dessus.
5. **Un champ absent, `null`, ou dans une autre forme, n'est pas une erreur.**
   On lit ce que les modèles envoient (`shares`, `employment`, `vow` imbriqué,
   `reason` pour `reasoning`) plutôt que de jeter une bonne décision pour une
   question de forme.
6. **Réduire `max_tokens` pour gagner du débit tronquerait les modèles qui
   raisonnent.** Mesuré : 170 jetons de réponse pour trois modèles, 950 pour
   `gpt-oss`.
7. **L'information n'était pas ce qui bloquait le choix de posture.** 79 % des
   dirigeants gardaient. On leur dit désormais la posture, les soldats et la
   taille de chaque voisin bordé — leurs raisons parlent de frontières, mais
   onze postures sur douze restaient la garde. C'était le **prix** qui manquait,
   pas le renseignement : garder était gratuit, donc strictement meilleur.
8. **Une règle d'équilibrage peut faire du monde une question unique.** La
   croissance démarrait à quatre années de vivres, donc les civilisations
   vivaient au ras de l'alarme : 22 % des années sous le seuil, 38 % des
   décisions étaient des famines. À six, la famine redevient un accident et le
   mélange se diversifie. **Regarder la répartition des types de décision est le
   diagnostic le moins cher qui existe** — `npm run world:probe` le donne.
9. **Faire vivre le monde en silence avant de mesurer ne l'améliore pas.**
   L'idée était que le moteur étant gratuit, amener le monde au moment
   intéressant rendrait chaque appel plus utile. Mesuré : 230 décisions au lieu
   de 129 pour la même fenêtre, dont 46 % de famine — deux fois plus cher, et
   surtout des questions forcées. Aucune conquête non plus : elle demande qu'un
   dirigeant choisisse la pression, et un monde muet ne décide rien.
10. **Ce qui empêchait une campagne distante longue n’était ni le contrat ni
    le compte : c’était le modèle.** `longcat-2.0` raisonne, sur certaines
    requêtes, jusqu’à son plafond de 6 000 jetons et ne répond jamais — 133 s,
    zéro caractère — en ignorant `effort: "none"`, `"low"`, `enabled: false` et
    un plafond de raisonnement. Notre délai de 45 s le coupait avant, d’où un
    « délai dépassé » qui ressemblait à une panne du fournisseur. Avec
    `laguna-s-2.1`, même compte, même jour : **39 tours consécutifs**, rejeu
    vérifié. La leçon est de méthode : « le modèle ? non, les quatre dirigeants
    partagent le même » avait été écrit comme une réfutation — **partager un
    modèle ne l’innocente pas ; en essayer un autre, si.** Et un conseil fait
    9 197 jetons d’entrée : Groq gratuit (8 000 par minute) ne peut pas en
    servir un seul. Voir `docs/reports/fournisseurs.md`.

## Avant de dépenser du quota

```
npm run preflight        # 4 appels : chaque modele repond-il POUR LUI-MEME ?
npm run world:probe      # combien d'appels un monde demanderait. Zero depense
npm run board-fairness   # le bruit du plateau, donc ce qu'une mesure peut prouver
npm run bench:models     # modeles apparies sur 6 situations, puis --consecutive=20
```

**Seuls les modèles retenus gouvernent nos tests** : `packages/agents/src/stable-models.ts`,
chacun avec la mesure qui le justifie. Le défaut des quatre dirigeants en découle —
`dots-3-note-preview`, sans clé — et non plus `longcat-2.0`, qui perd un tour sur sept.
Y ajouter un modèle, c'est le remesurer (`bench:models`, critères dans
`docs/reports/banc-modeles.md`). Deux leçons du banc : un modèle **propre sur des
situations isolées peut se dégrader en partie réelle** — mesurer aussi en durée ; et un
modèle qui raisonne doit en être empêché (`REASONING_OFF_MODELS`), sinon il dépasse
tout délai — 45 s sans le champ, 6 s avec, même requête. Deux autres, du passage
OpenRouter/Mistral : **le même modèle chez un autre hébergeur est un autre candidat**
(`nex-n2.5-mini` : 15/20 par Kilo, 7/20 par OpenRouter) ; et **le banc ne suffit pas,
il faut une campagne par le produit** — le banc retirait le préfixe `openrouter:` que
le produit envoyait tel quel. `NOUS_MODEL` ne choisit plus le défaut : sur la machine
de développement il désignait encore `longcat-2.0`, et l'observatoire le proposait.

**Le direct** (`POST /api/campaigns/:id/live`) : le serveur joue une partie seul,
page fermée ou non, et la reprend après un redémarrage (`worlds/spectator/.live.json`).
Il redemande un dirigeant muet, ne le remplace jamais, et suspend en le disant. La
page suit toute partie qui avance par `/head`, qu'elle soit jouée ici ou par un autre
processus.

Le palier gratuit est un **budget d'appels**, pas une limite de débit — mesuré
deux fois. Tout script long reprend là où il s'est arrêté ; s'arrêter est le
mode normal.

Ce n'est pourtant pas tout. Un modèle peut ne pas répondre **à une requête
précise**, toujours la même, sans que le quota ni le compte y soient pour rien
(point 10 ci-dessus) : relancer le même état redonne le même blocage. Un script
qui enchaîne des appels doit donc écrire son état à chaque tour — il pourra
reprendre — et un « délai dépassé » se diagnostique en rejouant **cette**
requête avec un délai long et en lisant `finish_reason` et les jetons de sortie.
Nous, lui, refuse franchement quand il limite : un **HTTP 429**, observé à la
45ᵉ requête d'une campagne.

## Où regarder

|                                                     |                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| les règles et les six invariants                    | `docs/spec/world-w8.md`, puis `world-w9.md`                              |
| tout ce qui a été mesuré                            | `docs/reports/`                                                          |
| l'identité visuelle et la vue 3D                    | `docs/spec/visual-identity.md`                                           |
| la refonte du lecteur, validée, non commencée       | `docs/superpowers/specs/2026-08-25-aevum-observatory-redesign-design.md` |
| les conventions et le défaut qui a enseigné chacune | skill `project-conventions`                                              |

## Le principe, qui prime sur le reste

**On ne cherche pas à ce que les civilisations prospèrent. On cherche à voir
jusqu'où elles vont.**

Une civilisation qui s'effondre par ses propres décisions n'est pas un défaut du
monde, c'est le résultat. Une armée de dix qui marche sur un empire de cinq
mille a le droit de le faire, et de se briser. Le moteur donne des
possibilités — des ressources, des progrès, des terres à prendre — **jamais des
garde-fous qui garantissent la réussite**.

La distinction qui tranche les cas douteux : corriger un comportement
_automatique du moteur_ est légitime (personne ne l'a décidé) ; empêcher une
décision _d'un dirigeant_ ne l'est pas, même mauvaise. Le moteur refusait en
silence les attaques perdues d'avance — c'était une tutelle, elle a été retirée
en w8.

## Comment travailler ici

- **Un rapport de `docs/reports/` a une copie publiée, et la CI la vérifie.** Elle
  relance `npm run build-reports` et `npm run index-worlds`, puis échoue si le
  résultat diffère du dépôt. Après avoir touché un rapport : `npm run build-reports`,
  et commiter `apps/player/public/reports/` avec. Oublié plusieurs jours de suite
  en septembre ; la CI est restée rouge jusqu'à une réparation à la main.
- **Mesurer avant d'affirmer.** Presque toute affirmation de ce dépôt porte le
  chiffre qui la soutient, et plusieurs mesures ont réfuté la thèse qu'elles
  devaient servir. Quand c'est le cas, on l'écrit.
- **Un commentaire dit pourquoi, et de préférence quel défaut l'a appris.**
- **Le français pour les documents et les messages de commit, l'anglais pour le
  code et les prompts.**
- **Ne jamais faire passer une clé dans un commit, un prompt ou une URL.**
  `.env` est en 600 et ignoré ; la CI et les tests de frontière le vérifient.
