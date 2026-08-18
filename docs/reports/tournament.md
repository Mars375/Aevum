# Tournoi — quel modèle commande le mieux ?

Statut : exécuté · Date : 2026-08-18 · Tâche kanban : `t_32e3997f`
4 rotations · graines 42 à 45 · 183 appels · **0,00 $** · ~30 minutes
Replays : `replays/tournament/rotation-{0..3}.json`

C'est la question fondatrice du projet. Une bataille unique ne pouvait pas y
répondre : la faction attribuée et le taux de service du modèle fuyaient tous
deux dans le résultat. Le protocole vient de l'audit QA.

## Protocole appliqué

1. **Rotations cycliques.** Quatre concurrents, quatre factions : chacun occupe
   chaque coin exactement une fois. Aucun résidu positionnel ne survit.
2. **Graine fixée par rotation** (42, 43, 44, 45), consignée dans chaque manifest.
3. **Porte d'audit.** Chaque replay est rejoué à travers le moteur avant d'être
   compté. **Les 4 rotations sont reproductibles, 0 état divergent.**
4. **Taux de service séparé du score.** Un modèle servi 30 % du temps n'a pas mal
   joué : il n'a pas joué. Les deux tableaux ci-dessous sont volontairement
   distincts.
5. **Seuil de propreté à 100 %.** Une rotation ne compte au classement que si le
   concurrent y a été servi par son propre modèle à chaque appel.

## Taux de service — a-t-il seulement joué ?

| Modèle | Servi | Rotations propres |
| --- | --- | --- |
| `groq:openai/gpt-oss-120b` | **100 %** | **4/4** |
| `groq:groq/compound-mini` | 98 % | 3/4 |
| `nvidia/nemotron-3-super-120b-a12b:free` | 87 % | 1/4 |
| `poolside/laguna-s-2.1:free` | 79 % | **0/4** |

## Classement — rotations propres uniquement

| Modèle | Victoires | Survies | PV cumulés |
| --- | --- | --- | --- |
| `groq:openai/gpt-oss-120b` | **3** | 3 | **31** |
| `groq:groq/compound-mini` | 0 | 2 | 13 |
| `nvidia/nemotron-3-super-120b-a12b:free` | 0 | 1 | 5 |
| `poolside/laguna-s-2.1:free` | — | — | **NON CLASSÉ** |

`laguna-s` n'est pas dernier : il est **non classé**. Servi entre 75 % et 83 %
sur les quatre rotations, il n'a jamais disputé une bataille entière avec son
propre modèle. Le confondre avec un mauvais tacticien serait exactement l'erreur
que ce protocole existe pour empêcher.

## Ce que l'on peut affirmer

**`openai/gpt-oss-120b` commande mieux que les trois autres.** C'est la seule
conclusion solide du tournoi, et elle l'est doublement : il gagne 3 rotations
sur 4 **et** il est le seul servi à 100 % partout. Il gagne depuis trois coins
différents (crimson, amber, verdant), donc ce n'est pas un effet de position.

Détail par rotation :

| Rotation | Vainqueur | PV du vainqueur |
| --- | --- | --- |
| 0 (graine 42) | `gpt-oss-120b` en crimson | 5 |
| 1 (graine 43) | `gpt-oss-120b` en amber | 8 |
| 2 (graine 44) | `gpt-oss-120b` en verdant | 18 |
| 3 (graine 45) | `nemotron-3-super` en verdant | 11 |

## Ce que l'on ne peut pas affirmer

**Les trois autres modèles ne sont pas départageables sur cet échantillon.**
`compound-mini` a 3 rotations propres, `nemotron-3-super` une seule, `laguna-s`
aucune. Trois zéros de victoires sur des effectifs pareils ne classent rien.

## Une limite du protocole, découverte en l'exécutant

Le seuil de propreté à 100 % est **trop strict pour un palier gratuit**. Il
écarte **8 des 16 couples faction-rotation**, dont un cas gênant :

> Rotation 3, `nemotron-3-super` gagne la bataille — mais il n'a été servi
> qu'à 83 %, donc **sa victoire est écartée du classement**.

Le protocole se comporte comme prévu ; c'est son calibrage qui est en cause. Une
règle qui jette la moitié des données produit un classement défendable pour le
modèle le plus fiable, et rien du tout pour les autres.

Trois corrections possibles, à trancher :

1. **Abaisser le seuil à 90 %** et afficher le taux réel à côté de chaque
   résultat. Récupère 5 couples sur 8, au prix d'une contamination faible et
   visible.
2. **Augmenter le nombre de rotations.** À 7 minutes la bataille, 12 rotations
   coûtent 1 h 30 et donnent 3 passages par coin. C'est l'option la plus propre
   et elle reste gratuite.
3. **Réessayer une rotation sale** au lieu de l'écarter. Simple, mais biaise
   l'échantillon vers les moments où le palier gratuit est calme.

**Recommandation initiale : l'option 2.** — ⚠️ **Réfutée par la mesure**, voir la
section suivante. Augmenter le nombre de rotations dégrade le tournoi au lieu de
l'améliorer.

## Deuxième exécution — 12 rotations, et ma recommandation réfutée

Le rapport ci-dessus recommandait « augmenter le nombre de rotations » comme la
correction la plus propre. **Cette recommandation est fausse. La mesure la
réfute.**

12 rotations ont été jouées (558 appels contre 183). Résultat :

| Modèle | Servi (4 rotations) | Servi (12 rotations) | Rotations propres |
| --- | --- | --- | --- |
| `groq:openai/gpt-oss-120b` | 100 % | **11 %** | 1/12 |
| `groq:groq/compound-mini` | 98 % | **3 %** | 0/12 |
| `nvidia/nemotron-3-super-120b-a12b:free` | 87 % | **51 %** | 1/12 |
| `poolside/laguna-s-2.1:free` | 79 % | **59 %** | 2/12 |

Aucune victoire n'a pu être attribuée. Le tournoi long produit **moins**
d'information que le court.

### Ce que montre la chronologie

| Rotation | Taux de service moyen | Rotations propres |
| --- | --- | --- |
| 0 | 76 % | 2/4 |
| 1 | 52 % | 1/4 |
| 2 – 3 | 44 % → 40 % | 0/4 |
| 4 – 7 | 46 % → 35 % | 1/4 puis 0 |
| **8 – 11** | **0 %** | **0/4** |

Dégradation monotone, puis **effondrement complet à partir de la rotation 8**.
À ce stade, plus aucun général n'est servi par son propre modèle — pas une seule
fois sur les quatre dernières rotations.

### La cause, et pourquoi je m'étais trompé

Le palier gratuit n'est pas seulement limité en **débit**, il l'est en **volume
quotidien**. Le raisonnement « une bataille coûte 7 minutes, donc 12 rotations
coûtent 1 h 30 et restent gratuites » comptait le temps. Ce qu'il fallait
compter, ce sont les **appels** : 183 passent, 558 non.

Le point de bascule observé se situe autour de **350 appels cumulés**.

À noter, et c'est à mettre au crédit de l'architecture plutôt qu'à sa charge :
**les douze batailles se sont terminées normalement**, 48 appels chacune, audit
reproductible sur les douze. Les chaînes de repli ont fait exactement leur
travail. Le système s'est dégradé proprement au lieu de tomber — bon en
ingénierie, ruineux pour l'expérience, puisque tout le monde a fini par jouer
avec le modèle de quelqu'un d'autre.

### Recommandation corrigée

**Rester sous ~200 appels par session**, soit 4 rotations de 12 tours. C'est le
régime dans lequel le tournoi de référence a produit un résultat défendable.

Pour aller au-delà, trois options réelles :

1. **Étaler les rotations sur plusieurs jours**, une session de 4 par jour. Gratuit,
   lent, et statistiquement propre. C'est l'option honnête.
2. **Raccourcir les batailles** — 8 tours au lieu de 12 fait 32 appels par
   rotation au lieu de 48, donc 6 rotations dans le même budget.
3. **Payer.** Quelques euros lèvent la contrainte entièrement.

L'option 1 est recommandée. Ce qu'il faut retenir surtout : **la contrainte du
palier gratuit est un budget d'appels, pas un budget de temps**, et tout
protocole qui l'ignore produira des données propres au début et du bruit ensuite.

## Reproduire

```
npm run tournament                              # 4 rotations, graine 42 — le régime utilisable
ABS_TOURNAMENT_SEED=100 npm run tournament      # autre graine
ABS_TOURNAMENT_ROTATIONS=12 npm run tournament  # possible, mais s'effondre après ~350 appels
```

Le script écrit un checkpoint après chaque tour, donc une interruption ne coûte
qu'une rotation. `replays/tournament/results.json` contient les données brutes
de ce rapport.
