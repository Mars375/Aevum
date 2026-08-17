# Règles de bataille — ruleset `v1`

Statut : validé · Date : 2026-08-17 · Tâche kanban : `t_c506e05b`

Ce document est la source de vérité du moteur. Toute divergence entre ce texte
et `packages/engine` est un bug du moteur. Le champ `rulesetVersion` du manifest
de replay vaut `v1` et référence cette version du document.

## Principe fondateur — décision et résolution sont étanches

| Le général LLM | Le moteur |
| --- | --- |
| Reçoit une vue de l'état, produit des ordres JSON. | Reçoit des ordres, produit l'état suivant. |
| Peut se tromper, halluciner, dépasser sa portée. | Rejette tout ordre illégal, ne le « corrige » jamais pour arranger le récit. |
| Est stochastique. | Est déterministe : mêmes ordres + même graine ⇒ même état, bit à bit. |
| Parle au réseau. | **N'émet aucun appel réseau.** Aucune dépendance HTTP dans `packages/engine`. |

Le moteur ne lit jamais de position dans un ordre. Il ne lit que `squadId`,
`action` et `target`. Les positions font autorité côté moteur, uniquement.

## Carte

Grille de **16 × 16**, coordonnées entières `(x, y)` de `(0,0)` en haut à gauche
à `(15,15)` en bas à droite. Aucun obstacle, aucun terrain, aucune élévation au
ruleset v1.

Toutes les distances sont des **distances de Chebyshev** :
`d = max(|x₁ − x₂|, |y₁ − y₂|)`. Les huit directions coûtent donc pareil, ce qui
rend l'adjacence diagonale naturelle pour la mêlée.

## Unités

Deux archétypes, aucune personnalisation au MVP :

| Archétype | PV | Déplacement | Portée | Dégâts |
| --- | --- | --- | --- | --- |
| `MELEE` | 10 | 2 | 1 | 4 |
| `RANGED` | 8 | 1 | 4 | 3 |

Chaque faction aligne exactement une escouade de chaque archétype.

### Budget d'armée

Le ruleset v1 **fixe** la composition : 2 escouades imposées, une de chaque
archétype, pour les quatre factions. Le budget existe donc formellement mais
n'a aucun degré de liberté — il ne devient un vrai levier qu'en phase 2, avec
la composition d'armée (carte `t_a5441071`). Le champ `budget` est absent du
schéma v1 plutôt que présent et inutilisé.

### Déploiement

Symétrique, fixe, sans aléa — la symétrie est ce qui rend la comparaison entre
modèles honnête :

| Faction | Coin | `MELEE` | `RANGED` |
| --- | --- | --- | --- |
| Crimson | haut-gauche | (2, 2) | (1, 3) |
| Azure | haut-droit | (13, 2) | (14, 3) |
| Verdant | bas-droit | (13, 13) | (14, 12) |
| Amber | bas-gauche | (2, 13) | (1, 12) |

## Visibilité

Totale au ruleset v1. Chaque général voit toutes les escouades vivantes, alliées
et ennemies, avec leurs positions et leurs PV exacts. Le brouillard de guerre
appartient à la phase 2.

La vue locale reste néanmoins un objet distinct de l'état monde : elle marque
quelles escouades appartiennent au destinataire. Introduire le brouillard en
phase 2 se fera en filtrant cette projection, sans toucher au moteur.

## Ordres

Trois actions, une par escouade et par tour :

| Action | Sémantique de `target` |
| --- | --- |
| `MOVE` | Tuile de destination. |
| `ATTACK` | Tuile visée. |
| `HOLD` | La tuile occupée par l'escouade elle-même. |

## Résolution d'un tour

L'initiative est **simultanée**. Aucune faction ne joue « avant » une autre : il
n'existe aucun ordre de tour entre factions, donc aucun avantage de position
dans la liste. La résolution se fait en cinq phases, dans cet ordre fixe.

### Phase 1 — Validation

Chaque ordre est confronté aux règles anti-exploit ci-dessous. Un ordre rejeté
devient un `HOLD` et produit un événement `ORDER_REJECTED` portant le motif.
Une escouade vivante sans ordre reçoit un `HOLD` implicite et un événement
`ORDER_MISSING`.

### Phase 2 — Déplacement

Tous les `MOVE` sont appliqués simultanément. Une escouade est dite *fixe* si
elle tient (`HOLD`), attaque, ou si son déplacement a échoué.

Un déplacement réussit si et seulement si :

1. la destination est dans la grille ;
2. la distance de Chebyshev depuis la position de départ est ≤ au déplacement de
   l'archétype ;
3. **exactement une** escouade revendique cette destination ;
4. aucune escouade *fixe* n'occupe cette destination.

Les conditions 3 et 4 sont évaluées **par itération jusqu'au point fixe** : un
déplacement qui échoue rend son escouade fixe, ce qui peut invalider un autre
déplacement, et ainsi de suite. L'ensemble des escouades fixes ne fait que
croître, la boucle converge donc toujours, en au plus autant de passes qu'il y a
d'escouades. Le résultat ne dépend d'aucun ordre de parcours — c'est ce qui rend
la simultanéité réelle et non un tour par tour déguisé.

Un déplacement échoué produit un événement `MOVE_BLOCKED` et l'escouade reste
sur place. Deux escouades qui visent la même tuile échouent **toutes les deux** :
personne n'obtient la tuile par priorité.

### Phase 3 — Combat

Tous les `ATTACK` sont résolus simultanément, contre les positions **postérieures
au déplacement**, et les dégâts sont calculés sur un **instantané des PV pris
avant la phase**.

Pour chaque attaque :

1. Si la distance de Chebyshev entre l'attaquant et la tuile visée dépasse sa
   portée, l'attaque échoue : événement `ATTACK_OUT_OF_RANGE`.
2. Si aucune escouade vivante n'occupe la tuile visée après déplacement,
   l'attaque frappe le vide : événement `ATTACK_MISSED`. C'est une conséquence
   assumée de la simultanéité — une cible qui bouge esquive.
3. Si l'occupant appartient à la faction de l'attaquant, l'attaque est annulée :
   événement `ATTACK_FRIENDLY_BLOCKED`. Aucun tir fratricide au ruleset v1.
4. Sinon l'occupant subit les dégâts de l'attaquant : événement `ATTACK_HIT`.

Parce que les dégâts sont lus sur l'instantané, **deux escouades peuvent
s'entretuer dans le même tour**. C'est voulu.

### Phase 4 — Élimination

Toutes les escouades à PV ≤ 0 sont retirées en même temps, après la totalité de
la phase de combat. Événement `SQUAD_DESTROYED`.

### Phase 5 — Fin de partie

Une faction est éliminée quand ses deux escouades sont détruites.

- S'il ne reste **qu'une** faction : elle gagne, la bataille s'arrête.
- S'il ne reste **aucune** faction : match nul par annihilation mutuelle.
- Au terme du **tour 12**, départage dans cet ordre : total de PV restants, puis
  nombre d'escouades vivantes, puis match nul.

## Aléa et graine

Le ruleset v1 **ne consomme aucun aléa**. Les dégâts sont fixes, le déploiement
est fixe, il n'y a ni jet de toucher ni initiative tirée au sort. La
reproductibilité du moteur est donc une propriété structurelle et non le fruit
d'un générateur bien amorcé.

La graine est malgré tout enregistrée dans le manifest et le moteur expose un
générateur pseudo-aléatoire qu'elle amorce, sans l'appeler. Cette plomberie
existe pour la phase 2 ; la déclarer maintenant évite un changement de format de
replay plus tard. Un invariant de test vérifie que le compteur d'appels du
générateur reste à zéro sur une bataille complète — si une règle future
introduit de l'aléa, ce test échoue et force à en prendre acte.

## Anti-exploits

Ce sont les motifs de rejet en phase 1. Chacun est directement testable.

| # | Situation | Traitement |
| --- | --- | --- |
| 1 | `squadId` inconnu | Ordre ignoré, `ORDER_REJECTED: UNKNOWN_SQUAD` |
| 2 | `squadId` appartenant à une autre faction | Ignoré, `FOREIGN_SQUAD` |
| 3 | Ordre visant une escouade morte | Ignoré, `DEAD_SQUAD` |
| 4 | Plusieurs ordres pour la même escouade | **Seul le premier compte**, les suivants : `DUPLICATE_ORDER` |
| 5 | Escouade vivante sans ordre | `HOLD` implicite, `ORDER_MISSING` |
| 6 | Destination hors grille | `HOLD`, `OUT_OF_BOUNDS` |
| 7 | Destination hors portée de déplacement | `HOLD`, `MOVE_TOO_FAR` |
| 8 | `ATTACK` hors portée | Attaque annulée, `ATTACK_OUT_OF_RANGE` |
| 9 | `ATTACK` sur sa propre faction | Annulée, `ATTACK_FRIENDLY_BLOCKED` |
| 10 | `HOLD` dont la cible n'est pas sa propre tuile | Cible **normalisée** sur sa tuile, pas de rejet — c'est inoffensif |
| 11 | Justification (`reasoning`) démesurée | Tronquée à 2000 caractères dans le replay |

Le point 4 mérite d'être souligné : « le premier compte » est un choix
délibérément déterministe. Prendre le dernier, ou fusionner, ouvrirait la porte
à un général qui empile les ordres pour obtenir un traitement particulier.

## Invariants testables

Le moteur est livré avec un test par ligne de ce tableau.

| Invariant | Énoncé |
| --- | --- |
| `I1` Conservation | Aucune escouade n'apparaît en cours de bataille ; le nombre d'escouades décroît de façon monotone. |
| `I2` PV bornés | Les PV ne dépassent jamais le maximum de l'archétype et ne descendent jamais sous 0 dans l'état publié. |
| `I3` Occupation unique | Après chaque tour, deux escouades vivantes n'occupent jamais la même tuile. |
| `I4` Grille close | Toute escouade vivante est dans `[0,15] × [0,15]`. |
| `I5` Déplacement légal | Le déplacement effectif d'une escouade sur un tour est toujours ≤ à son déplacement d'archétype. |
| `I6` Simultanéité | Permuter l'ordre des factions dans le tableau d'ordres ne change pas l'état résultant. |
| `I7` Entre-tuerie | Deux escouades qui se portent des coups mortels le même tour meurent toutes les deux. |
| `I8` Déterminisme | Deux exécutions avec les mêmes ordres et la même graine produisent des états strictement égaux. |
| `I9` Pureté | Le moteur ne consomme aucun aléa au ruleset v1 : le compteur du générateur reste à 0. |
| `I10` Terminaison | Toute bataille s'arrête au plus tard à la fin du tour 12. |
| `I11` Ordre illégal inoffensif | Un lot d'ordres entièrement illégaux laisse l'état inchangé, hormis les événements de rejet. |

## Exemple de tour complet

État initial, tour 1. `crimson-melee` en (2,2), `azure-ranged` en (14,3).

```
Ordres reçus
  crimson-melee   MOVE   (4,2)     — légal, distance 2
  crimson-ranged  ATTACK (14,3)    — distance 13, hors portée 4
  azure-melee     MOVE   (4,2)     — distance 9, au-delà de son déplacement 2
  azure-ranged    HOLD   (0,0)     — cible non conforme

Phase 1 — validation
  crimson-ranged  → HOLD           ATTACK_OUT_OF_RANGE différé en phase 3
  azure-melee     → HOLD           ORDER_REJECTED: MOVE_TOO_FAR
  azure-ranged    → HOLD (14,3)    cible normalisée, aucun rejet

Phase 2 — déplacement
  crimson-melee   (2,2) → (4,2)    seul revendiquant, aucune escouade fixe sur place

Phase 3 — combat
  crimson-ranged  ATTACK_OUT_OF_RANGE

Phase 4 — élimination
  aucune

Phase 5 — fin de partie
  quatre factions vivantes, on continue
```
