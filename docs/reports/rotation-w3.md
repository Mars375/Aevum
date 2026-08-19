# Rotation w3 — une mesure ratée, et pourquoi

Statut : mesuré, non concluant · 4 rotations × 120 ans, graine 1789 · Carte : `t_baa4de0e`

La rotation sous w1 avait donné le premier classement défendable du projet. La
même mesure sous w3 n'en donne aucun, et la raison est un défaut de mon
protocole, pas du jeu.

## Ce que la course a rendu

| modèle | terres moy. | décisions | servies par lui |
| --- | ---: | ---: | ---: |
| `gemma-4-26b` | 26,3 | 23 | 14 (61 %) — **non classable** |
| `mistral-large` | 18,8 | 25 | 24 (96 %) |
| `gpt-oss-120b` | 15,3 | 25 | 1 (4 %) — **non classable** |
| `laguna-s-2.1` | 14,5 | 23 | 23 (100 %) |

Terres finales par rotation :

| modèle | rot 0 | rot 1 | rot 2 | rot 3 |
| --- | ---: | ---: | ---: | ---: |
| gemma-4-26b | 25 | 24 | 31 | 25 |
| mistral-large | 25 | 23 | 23 | 4 |
| gpt-oss-120b | 25 | 25 | 3 | 8 |
| laguna-s-2.1 | 5 | 8 | 23 | 22 |

## Le défaut : rien ne contrôlait *quand* un modèle gouvernait

Le service de gemma, rotation par rotation :

> **5/5 · 4/4 · 5/6 · 0/8**

Ce n'est pas une dégradation, c'est une panne franche sur la dernière rotation.
Les rotations tournaient **en séquence**, donc le quota gratuit épuisé en fin de
journée tombait entièrement sur la quatrième. Faire tourner la position contrôle
*quelle faction* un modèle gouverne ; rien ne contrôlait *à quel moment de la
journée* il gouvernait.

Autrement dit : **les 61 % de gemma sont un artefact de l'ordre d'exécution, pas
une propriété de gemma.** Son exclusion par ma propre règle des 70 % est
techniquement correcte et matériellement trompeuse — et c'est précisément le
genre de chose qu'un seuil mécanique doit produire plutôt que masquer.

Corrigé : les rotations sont désormais **entrelacées**. Chaque rotation vit une
tranche de vingt ans, puis on passe à la suivante, et on recommence. Un quota
qui se tarit frappe alors les quatre rotations également au lieu de s'abattre
sur la dernière.

## Ce que la course dit quand même

**La variance par position est plus forte qu'en w1.** `mistral-large` fait 25,
23, 23 puis 4 ; `laguna-s` fait 5, 8, 23, 22. En w1, les écarts étaient de
l'ordre de dix terres ; ici ils vont de 4 à 25. Les catastrophes ajoutent du
bruit par position — ce qui est voulu comme jeu, et coûteux comme mesure. Quatre
rotations ne suffisent probablement plus à moyenner ce bruit.

**`gpt-oss-120b` reste à zéro**, et cette fois ce n'est pas l'ordre : 0/6, 0/5,
1/8, 0/6 — il est starvé dans toutes les rotations. Son fournisseur réserve le
`max_tokens` complet contre un budget par minute, et les appels d'un monde
arrivent groupés (quatre civilisations réveillées la même année). C'est un
problème distinct et persistant.

## Ce qu'il faut pour trancher

1. Rejouer la rotation **entrelacée** sur un quota frais.
2. Probablement six à huit rotations plutôt que quatre, pour absorber le bruit
   des catastrophes.
3. Traiter le cas `gpt-oss` séparément : soit une chaîne de repli qui ne le
   maquille pas, soit son retrait du roster tant qu'il n'est pas servable.

En attendant, **le classement w1 reste le dernier défendable** — et il porte sa
propre limite : il a été mesuré sous des règles plus simples, sans terres
typées, sans catastrophes, sans serments. Il dit qui gouvernait le mieux un jeu
que nous ne jouons plus.
