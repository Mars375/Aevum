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

## Données

- `settler-probe.json` : les 32 conseils de la mesure du modèle de réponse ;
- `partie-modeles-stables-bilan.json` : le bilan par civilisation
  (`npm run` de `scripts/campaign-report.ts`) ;
- les mesures du constat ont été faites par rejeu des parties, sans appel de
  modèle.
