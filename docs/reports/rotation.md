# Rotation des modèles — le premier classement défendable

Statut : mesuré · 4 rotations × 120 ans, graine 1789 · Carte kanban : `t_baa4de0e`

L'ère 1 avait produit un classement clair et inutilisable : crimson finissait
avec 47 des 80 terres, mais crimson était à la fois « la civilisation qui a pris
l'initiative à l'an 142 » et « celle gouvernée par `mistral-large` ». Une seule
course ne sépare pas les deux.

Cette mesure fait tourner **le même monde quatre fois**, en permutant seulement
qui gouverne quoi. Même graine, mêmes saisons, mêmes bandits. Ce qui reste
différent, c'est la gouvernance.

## Résultat

| modèle | pop. moy. | terres moy. | décisions | servies par lui |
| --- | ---: | ---: | ---: | ---: |
| `google/gemma-4-26b-a4b-it:free` | 678 | **27,8** | 17 | 17 (100 %) |
| `mistral:mistral-large-latest` | 422 | 19,0 | 22 | 22 (100 %) |
| `groq:openai/gpt-oss-120b` | 341 | 15,5 | 21 | 3 (14 %) — **non classable** |
| `poolside/laguna-s-2.1:free` | 156 | 6,0 | 47 | 44 (94 %) |

Terres finales, par rotation :

| modèle | rot 0 | rot 1 | rot 2 | rot 3 |
| --- | ---: | ---: | ---: | ---: |
| gemma-4-26b | 28 | 26 | 28 | 29 |
| mistral-large | 14 | 25 | 21 | 16 |
| gpt-oss-120b | 16 | 11 | 13 | 22 |
| laguna-s-2.1 | 9 | 4 | 9 | 2 |

## Ce qui est établi

**gemma-4-26b gouverne le mieux.** Premier depuis les quatre positions, dans un
intervalle de trois terres (26 à 29). C'est ce qu'une rotation est censée
produire et que le projet n'avait jamais obtenu : un résultat qui ne dépend pas
de la place occupée.

**laguna-s-2.1 gouverne le moins bien.** Dernier depuis les quatre positions,
2 à 9 terres.

**mistral-large est deuxième, mais son écart va de 14 à 25 terres selon la
position.** Il est au-dessus de laguna partout ; il n'est pas séparable de la
troisième place autrement que par la position.

## Ce qui est annulé, et pourquoi je l'avais d'abord écrit

La première version de ce tableau annonçait « service 100 % » pour les quatre
modèles, et classait gpt-oss-120b troisième. C'était faux : la colonne comptait
*qu'une réponse était arrivée*, pas *que le modèle assigné avait répondu*.
**gpt-oss-120b a personnellement répondu à 3 de ses 21 décisions** ; les 18
autres sont parties à sa chaîne de repli. Sa troisième place est le résultat de
`mistral-medium`, pas le sien.

C'est exactement la leçon la plus ancienne des tournois — *un modèle servi 30 %
du temps n'a pas mal joué, il n'a pas joué* — que j'avais perdue en portant la
mesure des batailles vers les mondes. Le tableau la porte maintenant, avec un
marqueur explicite sous 70 %.

## Le signal auquel je ne m'attendais pas

**Une civilisation bien gouvernée est réveillée moins souvent.** Sur les mêmes
quatre positions et le même monde :

- gemma-4 : **17** décisions
- mistral-large : 22
- laguna-s : **47**

Une décision est levée quand l'état dépasse ce que la doctrine en place sait
résoudre. Une doctrine qui tient à travers les mauvaises années lève moins de
crises — et coûte donc moins d'appels. Le modèle qui gouverne le mieux est aussi
le moins cher à faire tourner, ce qui n'était ni prévu ni cherché.

## Les limites, écrites d'avance

- **Horizon fixe, pas fin d'ère.** L'ère 1 a tourné 402 ans sans se refermer,
  donc attendre la fermeture n'est pas un protocole. Chaque rotation vit 120 ans
  et se compare là.
- **Un seul tirage.** Même graine partout, ce qui isole la gouvernance mais ne
  dit rien de la robustesse à un autre monde. Il faudrait rejouer les quatre
  rotations sur deux ou trois graines.
- **Un modèle non classable reste dans le tableau** plutôt que d'en être retiré,
  parce que son absence est elle-même un résultat : sur palier gratuit, un
  modèle dont le fournisseur sature ne gouverne pas, quelle que soit sa qualité.
