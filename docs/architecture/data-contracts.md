# Contrats de données

Statut : validé · Date : 2026-08-17 · Tâche kanban : `t_55ab0f15`

## Où vit la vérité

Les schémas **sont** le contrat : `packages/contracts/src/index.ts`. Ce document
explique les choix, il ne les duplique pas. Toute divergence entre ce texte et le
code se tranche en faveur du code.

Le paquet `@abs/contracts` n'importe ni le moteur, ni le réseau, ni Vue. C'est
ce qui permet aux trois consommateurs — moteur, agents, lecteur — d'en dépendre
sans créer de cycle, et au lecteur de valider un replay sans embarquer le moteur.

## Les huit schémas

| Schéma | Rôle | Produit par | Consommé par |
| --- | --- | --- | --- |
| `BattleConfig` | Paramètres d'une bataille : graine, tours, généraux et leurs chaînes de repli | CLI | Orchestrateur, manifest |
| `WorldState` | État complet, escouades vivantes uniquement | Moteur | Moteur, lecteur |
| `LocalView` | Projection montrée à **un** général | Moteur | Agents |
| `Decision` | Ce que le modèle doit rendre : `reasoning` + `orders` | Modèle distant | Agents, moteur |
| `Order` | Un ordre : `squadId`, `action`, `target` | Modèle distant | Moteur |
| `BattleEvent` | Union discriminée de tout ce qui arrive dans un tour | Moteur | Lecteur |
| `Telemetry` | Modèle réellement servi, tokens, latence, tentatives, coût | Agents | Replay, audit |
| `Replay` | Manifest + état initial + tours + issue | CLI | Lecteur |

## Six décisions qui structurent le reste

### 1. `LocalView` est un type distinct de `WorldState`

Au ruleset v1 la visibilité est totale, donc `LocalView` ne fait que séparer
alliés et ennemis — la projection est presque l'identité. Elle existe quand même
comme type propre parce que le brouillard de guerre de la phase 2 se réduira
alors à filtrer cette seule fonction, sans toucher au moteur, aux agents ni au
format de replay. Fusionner les deux types maintenant reviendrait à programmer
une réécriture pour plus tard.

### 2. `WorldState.squads` ne contient que les vivants, en ordre canonique d'`id`

Pas de drapeau `alive`. Une escouade détruite disparaît, ce qui rend l'invariant
de conservation `I1` vérifiable par simple comptage et supprime toute la classe
de bugs « j'ai oublié de filtrer les morts ».

L'ordre est canonique — trié par `id` — partout : au déploiement comme après
chaque tour. C'est ce qui fait tenir l'invariant `I6` sur les événements autant
que sur l'état, et cela garantit qu'un diff de replay ne montre jamais un
remaniement d'ordre qui n'a pas eu lieu.

### 3. `BattleEvent` est une union discriminée, pas un texte

Le lecteur doit pouvoir colorer un `ATTACK_HIT` autrement qu'un `ATTACK_MISSED`
et compter les `ORDER_REJECTED` par motif. Une chaîne libre obligerait le
frontend à faire de l'analyse syntaxique sur de la prose. Chaque variante porte
exactement les champs dont l'affichage a besoin.

Les événements de rejet font partie du contrat au même titre que les coups
portés : le replay doit montrer qu'un général a donné un ordre illégal, sinon
la promesse « aucune sortie fabriquée » n'est pas vérifiable.

### 4. La télémétrie distingue `requestedModel` de `servedModel`

Sur le palier gratuit, la bascule de repli est le régime courant, pas
l'incident. Enregistrer uniquement le modèle servi effacerait l'information la
plus intéressante — quel général a dû se rabattre, et combien de fois. Les deux
champs sont donc conservés, avec `attempts` et un `servedModel` à `null` quand
toute la chaîne a échoué.

`costUsd` vaut toujours 0 avec la configuration actuelle. Le champ existe pour
qu'une exécution payante future reste auditable sans changer de version de
format.

### 5. Le schéma JSON strict est écrit à la main, en regard du schéma zod

L'API attend un JSON Schema en mode `strict` ; le moteur valide avec zod. Les
deux représentations sont maintenues séparément dans `packages/agents`, sans
générateur intermédiaire.

C'est une duplication assumée. Le mode `strict` d'OpenAI a des exigences propres
— `additionalProperties: false` obligatoire, toutes les propriétés listées dans
`required` — qu'un convertisseur automatique rend difficiles à contrôler
finement, pour une dépendance de plus. Le garde-fou est un test qui fait valider
le même échantillon par les deux schémas : ils ne peuvent pas diverger en
silence.

### 6. Le replay est un fichier JSON unique, autonome et statique

Pas de base de données, pas d'API de lecture. Un replay contient son manifest,
son état initial et l'intégralité de ses tours ; il s'ouvre hors ligne et se
diffe avec `git diff`. Le lecteur est un site statique qui charge ce fichier.

Le manifest porte trois versions distinctes — `replayVersion`,
`rulesetVersion`, `contractsVersion` — parce qu'elles bougent pour des raisons
différentes : le format de fichier, les règles du jeu, la forme des données. Un
replay ancien reste lisible tant que `replayVersion` est comprise.

## Idempotence et reproductibilité

`resolveTurn` est une fonction pure : mêmes entrées, mêmes sorties, aucune
horloge, aucun accès réseau, aucun état global. La seule source d'indéterminisme
du système entier est la couche LLM, et elle est entièrement journalisée.

Conséquence pratique : rejouer les ordres consignés dans un replay à travers le
moteur doit reproduire exactement les états consignés. C'est ce que vérifie le
test de round-trip du replay, et c'est ce qui rend l'audit possible sans
rappeler un seul modèle.

## Contrat de la cartographie 2D du monde vivant

La carte de référence consomme directement un `Year` produit par `chronicle(journal)` :

- `year.world.board` est la source unique des cases, de leur nom, de leur relief et de leur propriétaire ; la couleur du territoire et ses frontières sont donc des dérivés du même tableau ;
- `Civ.capital` localise le siège, tandis que les autres cases possédées localisent les implantations ; la population dimensionne les marqueurs, sans créer de ville supplémentaire ;
- `Civ.stock`, `Civ.territory`, `Civ.population`, `Civ.soldiers`, `Civ.advances` et `Civ.doctrine` sont affichés comme agrégats de la civilisation sélectionnée ;
- `Year.events` et `Year.rulings` forment le registre daté. Un lien « rejouer » revient à l'année concernée et n'invente aucune position d'armée ou de front ;
- le contrat w8 ne localise pas les ressources, routes, infrastructures, migrations ou armées. La carte les signale comme absents plutôt que de dessiner des décorations qui ne seraient pas vérifiables.

Les couches peuvent être désactivées indépendamment, mais le rendu reste déterministe : même `Year` et même interaction initiale donnent la même carte. Le zoom et le déplacement ne modifient jamais l'état du moteur. La lecture temporelle de `WorldStage` est la seule écriture d'état : elle sélectionne un autre `Year` du même rejeu.

## Ce qui ne transite jamais

Ni clé API, ni contenu de `.env`, ni identifiant, ni chemin de la machine
n'entrent dans un prompt ou dans un replay. Les prompts ne contiennent que
l'état public du champ de bataille. La clé circule uniquement dans l'en-tête
`Authorization`. La justification d'un général est tronquée à 2000 caractères
avant d'entrer dans le replay, ce qui borne la taille du fichier et évite qu'une
sortie de modèle emballée ne serve de vecteur d'encombrement.
