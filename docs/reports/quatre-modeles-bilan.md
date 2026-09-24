# Quatre modèles face à face — bilan d'une partie de 300 manches

Partie `5336c8d2`, graine 42, règles `spectator-10`, jouée en direct du 24 au
25 septembre 2026 par le serveur, les quatre modèles retenus sur le même monde.
Données : `5336c8d2-3ec4-43a7-8199-8cd0ec406e1d-bilan.json`
(`scripts/campaign-report.ts`), rejeu vérifié de bout en bout.

## D'abord : qui a gouverné

| civilisation | modèle (hébergeur)         | servi par lui-même | tours sans rejet | ordres rejetés | latence médiane |
| ------------ | -------------------------- | -----------------: | ---------------: | -------------: | --------------: |
| Ambre        | `dots-3-note` (Kilo)       |            300/300 |              286 |             14 |           4,7 s |
| Azur         | `nex-n2.5-mini` (Kilo)     |            300/300 |              251 |             61 |           3,3 s |
| Pourpre      | `codestral` (Mistral)      |            300/300 |              299 |              1 |           3,8 s |
| Sylve        | `dots-3-note` (OpenRouter) |            300/300 |              298 |              2 |           5,5 s |

**1 200 actions, chacune jouée par le modèle demandé.** Aucun remplacement,
aucun repli. Le direct s'est suspendu deux fois sur Ambre (tours 112 et 132),
avant l'allègement du conseil ; relancé, il n'a plus échoué. Les quatre sont
classables.

## Ce qui s'est passé

| civilisation | âge atteint | population | villes | cases | avancées | plans menés | colons |
| ------------ | ----------- | ---------: | -----: | ----: | -------: | ----------: | -----: |
| Ambre        | futur       |        568 |      2 |     5 |        6 |          21 |      0 |
| Azur         | futur       |        612 |      2 |     6 |        6 |          46 |      0 |
| Pourpre      | futur       |        612 |      2 |     6 |        6 |           1 |      0 |
| Sylve        | médiéval    |        612 |      2 |     6 |        6 |          11 |      0 |

Pour tout le monde : 4 villes fondées, 153 chantiers, 42 avancées, 10 paix, 2
pactes tenus jusqu'au bout. Aucune guerre, aucune conquête, aucune famine. 125
cases sur 169 sont encore libres à la fin.

Les styles diffèrent nettement, plus que les résultats :

- **Azur** (`nex-n2.5-mini`) gouverne par plans — 46 menés à terme — et par la
  science et la croissance ; c'est aussi lui qui se trompe le plus d'ordres (61).
- **Pourpre** (`codestral`) ne dévie jamais : 300 tours en focus « équilibré »,
  un seul plan, un seul ordre rejeté. Propre, et immobile.
- **Sylve** (`dots-3-note` par OpenRouter) mise tout sur la croissance — 248
  tours sur 300 — et reste au Moyen Âge.
- **Ambre** (`dots-3-note` par Kilo), le même modèle, gouverne autrement :
  « équilibré », de la science, et atteint le futur.

## Ce que cette partie ne dit pas

- **Elle ne classe pas les modèles.** Une seule partie, un seul plateau : son
  bruit pèse autant que les modèles (`board-noise.md`). Le même modèle, `dots`,
  y mène une civilisation au futur et une autre au Moyen Âge — la place sur la
  carte et le hasard des conseils comptent au moins autant que le modèle.
- **Les résultats se ressemblent parce que le monde ne les sépare pas.** La
  population croît de la même façon pour tous, quoi qu'ils décident, et rien ne
  pousse à s'étendre (`pourquoi-pas-de-guerre.md`). Les 612 habitants de trois
  civilisations sur quatre en sont la trace. Tant que ce n'est pas rééquilibré,
  une partie compare surtout des styles, pas des résultats.
- **La qualité du gouvernement n'est pas mesurée**, seulement ce qu'il a produit
  dans un monde qui ne punit presque rien.
