# Rotation w4 — un seul écart tient, et il faut le dire

Statut : mesuré · 3 graines × 4 rotations × 60 ans, 12 courses · Carte : `t_baa4de0e`

Première rotation menée avec le protocole complet : préflight avant de dépenser,
courses entrelacées, horizon court, plusieurs graines, et le plancher de bruit
mesuré d'avance.

## Ce que les douze courses ont rendu

| modèle | lieux moy. | écart-type | décisions | servies par lui |
| --- | ---: | ---: | ---: | ---: |
| `mistral-large` | 7,17 | 2,04 | 46 | 44 (96 %) |
| `gpt-oss-120b` | 6,50 | 1,93 | 36 | 30 (83 %) |
| `laguna-s-2.1` | 6,17 | 1,99 | 37 | 30 (81 %) |
| `gemma-4-26b` | 5,00 | 2,00 | 33 | 23 (70 %) |

## Ce qui se sépare, et ce qui ne se sépare pas

L'erreur type est de 0,58 lieu par modèle (12 courses). Un écart n'est croyable
qu'à partir d'environ deux erreurs types combinées.

| paire | écart | en erreurs types | |
| --- | ---: | ---: | --- |
| mistral-large vs gemma-4 | 2,17 | 2,6 | **séparables** |
| gpt-oss vs gemma-4 | 1,50 | 1,9 | non séparables |
| laguna vs gemma-4 | 1,17 | 1,4 | non séparables |
| mistral-large vs laguna | 1,00 | 1,2 | non séparables |
| mistral-large vs gpt-oss | 0,67 | 0,8 | non séparables |
| gpt-oss vs laguna | 0,33 | 0,4 | non séparables |

**Une seule affirmation tient : `mistral-large` gouverne mieux que `gemma-4`.**
Tout le reste est du bruit. Le classement du tableau est un ordre d'affichage,
pas un résultat.

Et même cette seule affirmation porte une réserve : gemma n'a servi que **70 %**
de ses propres décisions — exactement le seuil sous lequel ce projet déclare un
modèle non classable. Trois de ses dix décisions ont été prises par sa chaîne de
repli. Ce que la mesure établit est donc plus modeste que « mistral gouverne
mieux » : *mistral, servi à 96 %, fait mieux que gemma servi à 70 %.* Sur un
palier gratuit, être servable fait partie du résultat — mais ce n'est pas la
même chose que bien décider.

## La même donnée, lue en tenant compte de l'appariement

Comparer des moyennes sur douze courses jette le fait le plus fort du montage :
**dans une course, les quatre modèles partagent le même plateau, la même graine,
les mêmes saisons et les mêmes catastrophes.** Les comparer là supprime la
variance du monde au lieu d'essayer de la moyenner.

Rangs moyens sur les lieux tenus (1 = meilleur) :

| modèle | rang moyen |
| --- | ---: |
| `mistral-large` | 1,92 |
| `gpt-oss-120b` | 2,38 |
| `laguna-s-2.1` | 2,50 |
| `gemma-4-26b` | 3,21 |

Face à face, dans le même monde :

| | victoires | |
| --- | :---: | --- |
| mistral-large | **9 – 3** | gemma-4 |
| laguna-s | **8 – 2** | gemma-4 |
| mistral-large | **8 – 3** | laguna-s |
| gpt-oss | **7 – 2** | gemma-4 |
| mistral-large | 7 – 4 | gpt-oss |
| gpt-oss | 6 – 5 | laguna-s |

Ce que ça ajoute : **gemma-4 perd contre les trois autres**, pas seulement
contre mistral. Et mistral passe devant laguna. Aucune de ces avances n'atteint
deux écarts-types — ce sont des tendances, pas des verdicts — mais quatre paires
penchent dans le même sens et le rang moyen les confirme. C'est plus que ce que
la comparaison des moyennes avait pu extraire de la même donnée, sans un appel
de plus.

## Et pourtant : « le mieux » n'a jamais été défini

Le même appariement, sur d'autres mesures :

| mesure | premier | dernier |
| --- | --- | --- |
| lieux tenus | mistral-large | gemma-4 |
| population | mistral-large *(indistinct)* | gpt-oss |
| progrès techniques | **gpt-oss** | gemma-4 |

Sur la population, **toutes les paires sont indistinctes** et gemma remonte
deuxième. Sur les progrès, l'ordre s'inverse en tête : gpt-oss passe premier.

Ce n'est pas une contradiction, c'est un aveu : **ce projet n'a jamais dit ce
que « gouverner le mieux » veut dire.** Tenir le plus de terre, nourrir le plus
de gens et avancer le plus vite sont trois objectifs différents, et rien
n'oblige un dirigeant à les servir ensemble — une civilisation qui conquiert
nourrit moins bien, celle qui bâtit s'étend moins.

Dépenser cinq cents appels pour départager trois modèles sur les lieux tenus
reviendrait à trancher très précisément une question qu'on n'a pas choisie. Le
travail qui vient avant n'est pas une mesure : c'est de décider ce qu'on mesure.

## Le bruit gouverné est plus fort que le bruit du plateau

Mesuré d'avance sur 30 mondes muets à 60 ans : écart-type **1,4 lieu**.
Observé sur les douze courses gouvernées : **2,0**.

Gouverner ajoute de la variance plutôt que d'en retirer. C'est cohérent — un
dirigeant qui change de doctrine change de trajectoire — mais cela veut dire
qu'une mesure gouvernée a besoin de **plus** de courses que le plancher du
plateau ne le laissait croire, et non moins.

## Ce que ça coûterait de trancher

Pour séparer les trois modèles du milieu, dont les écarts vont de 0,3 à 1,0
lieu, il faudrait une erreur type d'environ 0,35, donc à peu près **32 courses
par modèle** : 8 graines × 4 rotations, environ 500 appels.

C'est un jour et demi de palier gratuit — atteignable en deux jours puisque
`scripts/eras.ts` reprend exactement là où il s'est arrêté. C'est le prix d'un
classement complet, et il est maintenant chiffré au lieu d'être espéré.

## Ce qu'on apprend malgré tout

**Le correctif de `ask` a tenu.** `gpt-oss-120b` n'avait servi que 1 de ses 25
décisions en w3 ; il en sert 30 sur 36 ici. Ce n'était donc pas une saturation
subie mais un défaut de code, et il est réparé.

**Le préflight a payé deux fois** : il a refusé un départ que gemma aurait
faussé, et il a révélé qu'un `vowFloor: null` faisait jeter des décisions
entières.

**Le classement w1 ne survit pas au changement de règles.** Il donnait gemma
premier depuis les quatre positions ; ici gemma est dernier. Ce n'est pas une
contradiction : ce n'est pas le même jeu. w1 n'avait ni carte, ni catastrophes,
ni serments. Un classement mesuré sous des règles mortes ne dit rien des règles
vivantes — et il faut se garder de reprendre l'ancien chiffre parce qu'il était
plus flatteur.
