# Le bruit du plateau — ce qu'une rotation doit franchir

Statut : mesuré hors ligne, sans dépenser un appel · 24 mondes muets · Carte : `t_baa4de0e`

Une rotation met chaque modèle à chaque place, ce qui annule l'avantage d'un
**coin**. Elle ne fait rien contre l'avantage d'un **monde** : une graine peut
offrir trois fleuves à portée d'un fondateur pendant qu'une autre l'emmure
derrière des collines. Si cet écart-là dépasse la différence entre modèles, une
rotation sur une seule graine mesure la carte.

Doctrines figées : tout ce qui distingue les civilisations est le sol reçu.
C'est exactement le bruit qu'une mesure gouvernée doit dépasser.

## Le plancher

| coin | lieux moyens | écart-type | min | max |
| --- | ---: | ---: | ---: | ---: |
| crimson | 15,3 | 4,9 | 4 | 23 |
| azure | 16,4 | 4,5 | 7 | 24 |
| verdant | 19,2 | 5,2 | 6 | 28 |
| amber | 18,3 | 6,5 | 7 | 27 |

- Écart moyen entre la meilleure et la pire d'un même monde : **12,4 lieux**.
- Écart-type sur l'ensemble : **5,6 lieux**.

Deux choses en découlent.

**Les coins ne se valent pas** : quatre lieux séparent crimson de verdant, par
la seule position de départ. La rotation existe précisément pour ça, et cette
mesure confirme qu'elle n'est pas une précaution théorique.

**Le classement w3 était à la limite du bruit.** Il annonçait gemma à 26,3
lieux contre 18,8 pour mistral — sept lieux d'écart, sur quatre courses, avec
une erreur type de 2,8. Deux erreurs types font 5,6. L'écart passait de
justesse, et je l'avais présenté comme établi sans jamais avoir mesuré ce
plancher.

## L'horizon long est un piège

Bruit relatif (écart-type divisé par la moyenne), par horizon :

| années | lieux | population | richesse |
| ---: | ---: | ---: | ---: |
| 60 | **0,21** | 0,23 | 1,35 |
| 120 | 0,32 | 0,32 | 0,87 |
| 200 | 0,40 | 0,52 | 0,85 |
| 320 | 0,56 | 0,62 | 0,96 |

La chance composée croît plus vite que le signal de gouvernance. **Une course
longue n'est pas une meilleure mesure, seulement une plus chère** — et elle est
deux fois plus bruyante à 320 ans qu'à 60.

La richesse est inutilisable comme critère : son bruit relatif dépasse 0,85
partout, et 1,35 sur les courses courtes. Les lieux tenus sont la mesure la plus
stable, la population la suit de près.

## La mise en route muette : une bonne idée, réfutée

Le moteur est gratuit, donc faire vivre le monde en silence jusqu'à ce qu'il
devienne intéressant — le plateau se remplit vers l'an 130 — devait rendre
chaque appel plus utile. C'était l'idée. Elle est fausse.

Douze mondes, soixante années gouvernées à chaque fois :

| mise en route | décisions levées | ce qu'elles demandent |
| ---: | ---: | --- |
| aucune | 129 | **progrès 50 %**, famine 22 %, pillage 22 % |
| 120 ans | 230 | famine 46 %, trésorerie 23 %, catastrophe 21 %, frontière 3 % |
| 180 ans | 244 | **famine 70 %**, trésorerie 20 % |

La fenêtre tardive coûte **deux fois plus cher** et pose surtout des questions
**forcées** : une famine n'a qu'une réponse, et quatre modèles la donnent tous.
La fenêtre précoce, elle, est dominée par les progrès techniques — « vous venez
de débloquer quelque chose, qu'en faites-vous » — qui est une vraie question
ouverte.

Et elle ne produit toujours aucune conquête, pour une raison qu'il fallait
voir : **une conquête demande qu'un dirigeant choisisse la pression**, et une
mise en route muette ne décide rien par définition. On ne peut pas préparer un
conflit sans joueurs.

Le bouton `--warmup` reste, parce qu'il est mesuré et qu'il sert à observer un
monde mûr. Il ne sert pas à mesurer des modèles, et son défaut est zéro.

## Le protocole qui en découle

Des courses **courtes et nombreuses**, plutôt que longues et rares :

| courses | erreur type | écart croyable |
| ---: | ---: | ---: |
| 4 (1 graine) | 2,8 | 5,6 |
| 8 (2 graines) | 2,0 | 4,0 |
| **12 (3 graines)** | **1,6** | **3,2** |
| 16 (4 graines) | 1,4 | 2,8 |

Retenu : **3 graines × 4 rotations × 60 ans**, soit environ 192 appels et 48 par
modèle. `scripts/eras.ts` imprime désormais ce calcul avant de dépenser quoi que
ce soit, et s'arrête de lui-même si un modèle sert moins de la moitié de ses
propres décisions — la dernière rotation a appris que le coût de s'en apercevoir
après coup est la course entière.
