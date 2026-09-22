# Ce que le navigateur a trouvé, et que 688 tests ne voyaient pas

Le fichier de livraison affirmait des choses qu'aucun test local ne pouvait
vérifier : que la vue 3D rend, que les modèles suivent les âges, que le lecteur
raconte la bonne histoire. Le navigateur d'Orca permet de les regarder. Ce
rapport dit ce que regarder a montré.

Une campagne `spectator-10` de 480 tours, servie en local, ouverte dans l'onglet
d'Orca. Trois défauts en sont sortis, dont deux qu'aucun test n'aurait pu voir —
et le troisième, qui explique pourquoi.

## 1. La campagne de démonstration ne se chargeait plus

Le lecteur affichait `Données invalides ou sauvegarde illisible` — la réponse
400 du serveur, indistinguable d'un fichier corrompu. Le fichier était sain :
c'est `replayCampaign` qui divergeait, **au tour 10**.

La cause n'est pas un défaut, c'est une conséquence. Le correctif de la trahison
(`b4b3db1`) faisait émettre `PACT_BROKEN` là où la rupture n'était que consignée.
Or les événements d'un tour alimentent `state.memory` : le dirigeant trahi **s'en
souvient** désormais, ce qui est précisément le but. Mais la mémoire fait partie
de l'état, donc de la signature, donc du rejeu.

Vérifié dans les deux sens : le moteur d'avant le correctif rejoue la campagne
jusqu'au bout, celui d'après diverge au tour 10.

**Ce qu'il faut en retenir : changer le comportement d'un jeu de règles déjà
joué invalide ses enregistrements.** C'est pour cela que les règles sont
numérotées. `spectator-10` n'étant publié nulle part, la portée réelle est d'un
fichier local, régénéré ; les cinq campagnes distantes courtes se rejouent
toujours, faute d'avoir jamais atteint une guerre pendant un pacte. Mais la
prochaine évolution d'un jeu de règles déjà livré demande un numéro, pas une
correction en place.

## 2. La vue 3D : ce qu'elle montre, et ce qu'elle ne montre pas

Elle rend, sans une erreur de console, et elle rend juste.

|                          |                                                                      |
| ------------------------ | -------------------------------------------------------------------- |
| toile                    | 1289 × 921, WebGL, ni chargement bloqué ni repli 2D                  |
| **architecture par âge** | **vérifiée contre le bilan** (voir ci-dessous)                       |
| terrain                  | reliefs, rivières, forêts, parcelles bornées aux couleurs des civils |
| cultures et sites        | champs labourés, entrée de mine avec ses rails contre la colline     |
| unités                   | silhouettes civiles et bannières de faction                          |
| erreurs console          | **aucune**                                                           |

L'architecture est la preuve la plus nette. Le bilan annonce **Azur au Moyen
Âge**, les trois autres à l'**Antiquité**. Sur la carte, le territoire d'Azur —
reconnaissable à sa bannière bleue — porte des **tours de pierre à toit
conique** ; partout ailleurs, des **temples à colonnes blanches et toit de
terre cuite**. Les modèles suivent donc les âges, et on le voit au lieu de le
déduire.

Les modèles civils et ceux des âges ne sont pas des fichiers : ils sont
construits par le code (`civilianModel`, `ageModel`, `infrastructureModel`).
Aucun `.glb` n'est demandé pour eux, donc aucun 404 silencieux possible — les
quatorze modèles livrés servent la projection ancienne.

**La limite, et elle est réelle :** au zoom maximum du diorama, une unité civile
fait environ treize pixels. On voit une silhouette, sa couleur de faction, son
allure — on ne distingue pas le chariot d'un colon du ballot d'un marchand. Le
rôle se lit sur l'étiquette et dans le panneau, pas sur la silhouette. Le
correctif « le colon n'est plus dessiné en marchand » est donc vérifié par le
test qui borne `unitAsset` et par le code — le colon a sa propre entrée dans les
six âges, et quatre silhouettes distinctes le portent (le paquetage à pied,
puis le chariot bâché, l'autocar, le rover d'habitat) — pas par l'œil.

## 3. Six seuils de version recopiés en clair — et ce qu'ils retiraient

Le rapport v10 racontait déjà que 92 gardes de version étaient recopiées dans le
dépôt et que `SPECTATOR_RULES` + `atLeast` les avaient remplacées. La conversion
en avait manqué six. Aucune ne fait échouer un test : **une liste périmée ne
casse rien, elle retire une capacité en silence.**

| où                              | ce que `spectator-10` perdait                                              |
| ------------------------------- | -------------------------------------------------------------------------- |
| `climate-report.ts`             | **tout le rapport climatique** — les crises du lot 2 ne s'affichaient plus |
| `campaign-summary.ts`           | le bilan comptait des **tours** en les appelant « manches »                |
| `spectator-server.ts` (conseil) | le serveur consultait **les quatre dirigeants** au lieu du seul acteur     |
| `spectator-server.ts` (reprise) | un dirigeant injoignable était **passé** au lieu d'être redemandé          |
| `spectator-server.ts` (crises)  | le compte à rebours d'incident partait du mauvais compteur                 |
| `spectator-server.ts` (limite)  | 1000 tours au lieu de 1200                                                 |

Celle du serveur est la plus chère : un conseil par tour devenait quatre. En
mode distant, c'est le quota multiplié par quatre, dans un projet dont le
principe est qu'**un modèle n'est consulté qu'aux points de décision**.

Celle du bilan est la plus visible, et elle se démontre à l'écran. Avant :
« Manche **480** », « Chronique terminée », le panneau de fin par-dessus la
carte. Après : « Manche **121** », la campagne se poursuit, « Ambre à son
tour ». L'horizon de cette campagne est de 300 manches : le lecteur la déclarait
finie **à 40 % de son parcours**, et nommait « manches » un compte de tours
quatre fois trop grand.

### La garde qui aurait coûté zéro

Les six ont été converties. Et `packages/contracts/test/boundaries.test.ts`
interdit désormais d'en écrire une septième : aucun fichier de `packages`, du
lecteur ou de `scripts` ne peut énumérer deux versions `spectator-N` à la
suite ; seul `spectator.ts`, qui définit l'échelle, en a le droit.

Trois vérifications, chacune contrôlée en réintroduisant le défaut pour
s'assurer qu'elle échoue bien :

- la garde de frontière signale le fichier fautif ;
- `climate.test.ts` exige le même rapport climatique en v10 qu'en v8 ;
- `campaign-summary.test.ts` exige des manches, et non des tours.

## Ce que ce contrôle ne prouve pas

- Une campagne, une résolution, un navigateur. Rien sur d'autres écrans que le
  monde, la fiche du dirigeant et le bilan.
- Le rendu n'a pas été comparé à une référence : « ça rend juste » est un
  jugement de l'œil sur une capture, pas une mesure.
- Le runtime du navigateur est tombé trois fois pendant la session, la machine
  manquant de mémoire. Aucune conséquence sur les constats, mais chaque commande
  a dû être réessayée.
