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

**Recommandation : l'option 2.** C'est la seule qui améliore la statistique sans
rien concéder sur la rigueur, et Groq l'a rendue abordable.

## Reproduire

```
npm run tournament                    # 4 rotations, graine 42
ABS_TOURNAMENT_SEED=100 npm run tournament
```

Le script écrit un checkpoint après chaque tour, donc une interruption ne coûte
qu'une rotation. `replays/tournament/results.json` contient les données brutes
de ce rapport.
