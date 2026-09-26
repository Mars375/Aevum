# Pourquoi les dirigeants ne font pas la guerre

Mesuré le 25 septembre 2026 sur les trois parties longues gouvernées par des
modèles, comparées à la partie de référence jouée par le dirigeant local.

## Le constat

| partie                           | actions | villes fondées | conquêtes | cases libres à la fin |
| -------------------------------- | ------: | -------------: | --------: | --------------------: |
| modèles retenus (dots, nex-mini) |     480 |              5 |         0 |             121 / 169 |
| quatre modèles face à face       |   1 074 |              4 |         0 |             125 / 169 |
| dirigeant local (référence)      |     480 |             21 |        84 |              50 / 169 |

Dans les deux parties récentes, aucune déclaration de guerre et aucun ordre
d'attaque ; 85 propositions de paix ou de commerce. Leurs soldats ne se sont
jamais trouvés à côté d'une case étrangère : 0 tour sur 1 920.

## Ce qui n'est pas en cause

- **Le moteur.** Le dirigeant local ordonne 399 attaques, dont aucune n'est
  refusée, et conquiert 84 cases. La guerre est possible et tranchée.
- **Le modèle de réponse de la consigne**, qui écrit
  `"recruitSettler":false`, une valeur déjà remplie. L'hypothèse était que les
  modèles la recopient. **Réfutée** : sur 8 situations réelles où un colon est
  abordable, avec la seule différence de ce champ (`false` contre
  `true or false`), `dots-3-note` en recrute 0 sur 8 dans les deux cas,
  `codestral` 1 sur 8 dans les deux cas (`settler-probe.json`). La consigne n'est
  donc pas modifiée.

## Ce qui l'est : rien ne manque

Sans colon, pas de ville nouvelle ; sans ville nouvelle, pas de frontière
commune ; sans frontière commune, rien à disputer. Les modèles ne recrutent
presque jamais de colon — 1 fois en 480 tours, 0 en 1 075, alors qu'un colon est
abordable 9 fois sur 10. Et ils n'ont aucune raison de le faire :

- **La population croît exactement pareil pour les quatre civilisations**, tour
  après tour : 100, 110, 120, 130, 166, 224, 309, 402. Elle ne dépend d'aucune
  décision.
- **Le logement ne la limite jamais** : 963 places pour 402 habitants chez Ambre.
- **Les vivres s'accumulent sans fin** : 8 358 en réserve pour un besoin de 976.

La croissance est de 1,5 % par tour dès que les vivres dépassent trois fois le
besoin et que le logement le permet (`development.ts`). Les deux conditions sont
toujours remplies : fonder une ville ne rapporte rien qu'on ne reçoive déjà.

C'est la leçon n° 8 de CLAUDE.md, dans l'autre sens : une règle d'équilibrage
peut faire du monde une question unique — ici, elle n'en pose aucune.

## Ce que ce rapport ne décide pas

Le principe du projet est de ne pas pousser les dirigeants : une civilisation
qui choisit la paix a le droit de le faire. Mais un choix n'en est un que s'il
coûte quelque chose. Corriger une croissance automatique qui ne dépend d'aucune
décision relève du moteur, donc c'est légitime — et c'est une décision de
conception, qui change toutes les mesures. **Elle n'est pas appliquée.**

Une proposition, pour une version `spectator-11` des règles (les parties
existantes resteraient rejouables à l'identique) :

1. **Un logement qui compte** : moins de places par case, plus par ville, pour
   que la population bute sur son logement en quelques dizaines de tours et que
   fonder une ville soit la façon de grandir.
2. **Une croissance qui dépend des réserves** plutôt qu'un seuil tout ou rien :
   plus de vivres, plus de croissance, jusqu'au logement.
3. **Une consommation qui suit la population**, pour que les réserves ne
   s'accumulent plus sans limite.

À mesurer avant d'adopter, comme la leçon n° 8 l'a fait : la répartition des
types de décision (`npm run world:probe` pour le monde continu, l'équivalent à
écrire pour les parties par tours), puis une partie de modèles retenus, en
vérifiant qu'aucune question — la famine en particulier — ne devient la seule.

## Appliqué : l'économie de `spectator-11`

Décidé le 26 septembre 2026, appliqué en `spectator-11` seulement : le monde
continu (w8) et toutes les parties déjà jouées gardent l'ancienne économie —
quinze parties rejouées à l'identique après le changement.

- **Logement** : 110 places par ville, 15 par case (au lieu de 140 et 35),
  +25 % avec la maçonnerie. Une capitale seule plafonne vers 125 habitants.
- **Croissance** : de 0,4 % à 2 % par tour selon les réserves (jusqu'à six tours
  de besoin), au lieu de 1,5 % dès que trois tours sont en réserve.
- **Réserves** : au-delà de dix tours de besoin, plus cinq par grenier, un
  cinquième de l'excédent se gâte chaque tour.
- **Les dirigeants le savent** : leur observation porte `housing` (population,
  capacité, places par ville et par case), et la consigne dit la règle. Un
  plafond invisible serait un piège, pas un choix.

**Mesuré sans modèle** (`economy-probe.json`, dirigeant local, graines 42, 7 et
123, 120 manches) :

|                | écart de population entre civilisations | plus grande population | famines |
| -------------- | --------------------------------------: | ---------------------: | ------: |
| `spectator-10` |                               116 à 262 |                    386 |       0 |
| `spectator-11` |                               245 à 700 |                    721 |       0 |

S'étendre rapporte désormais, et la famine ne devient pas la question unique :
aucune en six parties. Une civilisation qui ne fonde rien (deux villes, six
cases) plafonne vers 390 habitants au lieu de 612.

Ce que cela ne dit pas encore : si les **modèles** s'étendent. Le dirigeant
local s'étendait déjà. La mesure qui compte est une partie des modèles retenus
sous `spectator-11`, sur le même monde que la partie de référence.

## Mesuré avec les modèles : la contrainte mord, les modèles ne s'étendent pas

Partie `696781ac` sous `spectator-11`, comparée à la partie de référence
`5336c8d2` (`spectator-10`) : **même graine**, même plateau, coupées au même
nombre d'actions — 975 — pour que la règle soit ce qui diffère
(`scripts/rules-compare.ts`, `regles-10-11.json`). Chaque conseil des deux
parties a été servi par le modèle demandé (100 % partout).

| règles         | civilisation | modèle        | colons recrutés | villes | cases | population / logement |
| -------------- | ------------ | ------------- | --------------: | -----: | ----: | --------------------: |
| `spectator-10` | Ambre        | dots (Kilo)   |               0 |      2 |     5 |             568 / 569 |
|                | Azur         | nex-n2.5-mini |               0 |      2 |     6 |             612 / 613 |
|                | Pourpre      | codestral     |               0 |      2 |     6 |             612 / 613 |
|                | Sylve        | dots (OR)     |               0 |      2 |     6 |             612 / 613 |
| `spectator-11` | Ambre        | dots (Kilo)   |               0 |      2 |     6 |             387 / 387 |
|                | Azur         | dots (Kilo)   |               1 |      3 |    10 |             600 / 600 |
|                | Pourpre      | codestral     |               0 |      1 |     1 |             156 / 156 |
|                | Sylve        | dots (OR)     |               0 |      2 |     6 |             387 / 387 |

Dans les deux parties : 146 cases libres sur 169, aucune frontière commune,
aucune guerre, aucun ordre d'attaque.

- **La contrainte mord** : les quatre populations sont à leur logement exact.
  Et elle sépare enfin les décisions : de 156 à 600 habitants, là où
  `spectator-10` donnait 568 à 612 quoi qu'on fasse. Pourpre, qui n'a jamais
  posé son colon de départ, reste à une ville et une case, et le paie.
- **Les modèles ne s'étendent pas pour autant** : un colon recruté en 975
  actions, contre zéro. Ils voient pourtant le plafond — 60 décisions
  d'Ambre, d'Azur et de Sylve parlent de logement — mais y répondent par la recherche
  (« poursuivre l'irrigation pour débloquer la croissance et l'amélioration du
  logement »), pas par une ville.
- **Ce que la mesure ne peut pas dire** : une paire de parties, sans plancher
  de bruit ; et Azur a changé de modèle (`nex-n2.5-mini` a disparu entre les
  deux), donc sa ligne ne compare pas une règle. Le recul de la diplomatie
  (47 propositions en `spectator-10` sur 1 200 actions, aucune ici) n'est pas
  attribuable : peu nombreuses, surtout d'Azur, dont le modèle a changé.

C'est la leçon n° 7, dans une forme nouvelle : le prix manquait, il existe
désormais, et il ne suffit pas. Le conseil ne présente pas le colon comme la
réponse au plafond ; le lien entre « la population bute » et « fonder une
ville » reste à faire par le modèle, qui ne le fait pas. La piste suivante,
non appliquée : que l'observation dise, quand la population touche le
logement, combien une ville nouvelle en ajouterait et ce que coûte un colon —
une information, pas un ordre. À mesurer de la même façon.

## Données

- `regles-10-11.json` : la comparaison appariée ci-dessus
  (`npm run rules-compare -- <id-a> <id-b>`) ;

- `settler-probe.json` : les 32 conseils de la mesure du modèle de réponse ;
- `partie-modeles-stables-bilan.json` : le bilan par civilisation
  (`npm run` de `scripts/campaign-report.ts`) ;
- les mesures du constat ont été faites par rejeu des parties, sans appel de
  modèle.
