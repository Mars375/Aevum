# Rapport d'exécution — bataille de référence

Statut : exécutée · Date : 2026-08-17 · Tâche kanban : `t_f4c79504`
Replay : `replays/reference.json` · Graine 42 · Ruleset `v1`

Aucune sortie de ce rapport n'est fabriquée : tous les chiffres proviennent du
replay livré, et se recalculent en le relisant.

## Issue

**Victoire de verdant** à la limite des 12 tours, avec 15 PV restants contre 14
à azure. Un point d'écart. Deux escouades détruites sur huit.

| Faction | PV finaux | Escouades | Modèle préféré | Modèle réellement servi |
| --- | --- | --- | --- | --- |
| verdant | **15** | 2 | `openai/gpt-oss-20b` | `gemma-4-26b` ×11, échec ×1 |
| azure | 14 | 2 | `nemotron-3-super` | `nemotron-3-super` ×6, `gemma-4-26b` ×4, échec ×2 |
| crimson | 5 | 1 | `gemma-4-26b` | `gemma-4-26b` ×11, échec ×1 |
| amber | 5 | 1 | `nemotron-nano-9b-v2` | `nemotron-nano-9b-v2` ×6, `gemma-4-26b` ×4, `nemotron-3-super` ×2 |

## Le résultat le plus important n'est pas le vainqueur

**Le modèle préféré de verdant n'a jamais été servi. Pas une seule fois sur
douze tours.** `openai/gpt-oss-20b:free` a échoué à chaque appel et verdant a
joué l'intégralité de la bataille avec `gemma-4-26b`, le modèle de repli.

Or crimson jouait déjà `gemma-4-26b`. La bataille annoncée comme « quatre
modèles distincts s'affrontent » a en réalité opposé **le même modèle à
lui-même sur deux des quatre factions**, et 62,5 % de toutes les décisions de la
bataille ont été prises par ce seul modèle.

| Modèle réellement servi | Décisions | Part |
| --- | --- | --- |
| `google/gemma-4-26b-a4b-it:free` | 30 / 48 | 62,5 % |
| `nvidia/nemotron-3-super-120b-a12b:free` | 8 / 48 | 16,7 % |
| `nvidia/nemotron-nano-9b-v2:free` | 6 / 48 | 12,5 % |
| aucun — chaîne épuisée | 4 / 48 | 8,3 % |

La conséquence est directe : **ce replay ne permet pas de comparer quatre
modèles.** Il montre surtout que `gemma-4-26b` est le seul modèle gratuit
suffisamment disponible pour tenir une partie entière. C'est un résultat utile,
mais ce n'est pas celui que le dispositif prétendait produire.

Voir `docs/reports/qa-audit.md` pour le protocole correctif.

## Fiabilité mesurée

| Mesure | Valeur |
| --- | --- |
| Appels au total | 48 |
| Servis au premier essai | 22 (46 %) |
| Ont basculé sur un repli | 21 (44 %) |
| Chaîne entièrement épuisée | 4 (8 %) |
| Ordres finalement obtenus | 44 / 48 (92 %) |
| Latence min / médiane / max | 3,8 s / 58,1 s / 178,9 s |
| Tokens consommés | 61 173 |
| **Coût** | **0,00 $** |

Les quatre échecs complets sont journalisés en `GENERAL_UNREACHABLE` et les
escouades concernées ont tenu leur position. **Aucun ordre n'a été inventé côté
client**, ce qui se vérifie dans le replay : chaque `GENERAL_UNREACHABLE` est
suivi de deux `ORDER_MISSING` émis par le moteur.

## Déroulement tactique

| Événement | Compte |
| --- | --- |
| `MOVE_OK` | 31 |
| `ATTACK_OUT_OF_RANGE` | 18 |
| `ATTACK_HIT` | 11 |
| `ORDER_MISSING` | 7 |
| `MOVE_BLOCKED` | 6 |
| `ATTACK_MISSED` | 5 |
| `GENERAL_UNREACHABLE` | 4 |
| `ORDER_REJECTED` | 2 (`MOVE_TOO_FAR`) |
| `SQUAD_DESTROYED` | 2 |

**Seuls 2,4 % des ordres ont été rejetés à la validation** (2 sur 82) : les
généraux respectent bien la forme du schéma et les limites de déplacement.

En revanche, **18 attaques hors portée contre 11 attaques réussies**. Les ordres
sont formellement légaux — une attaque hors portée n'est pas un rejet, c'est une
action gaspillée en phase de combat — mais tactiquement les généraux visent
constamment des cibles qu'ils ne peuvent pas atteindre. La qualité formelle est
haute, la qualité tactique est faible. La distinction compte : durcir le schéma
n'y changerait rien, c'est le prompt qui doit rappeler la portée à chaque ordre.

## Reproductibilité — vérifiée sur ce replay

Les ordres consignés ont été rejoués à travers le moteur, sans aucun appel
réseau :

```
rejoue 12 tours a partir des ordres consignes uniquement
etats divergents : 0
tour final rejoue 12 == issue consignee 12 : true
VERDICT : replay REPRODUCTIBLE sans rappeler un seul modele
```

La promesse d'auditabilité tient sur des données réelles, et pas seulement dans
les tests.

## Secrets

Balayage du replay sérialisé pour `sk-or-`, `OPENROUTER_API_KEY`, `Bearer ` et
`/home/` : **aucune occurrence**.

## Métriques du MVP — deux cibles manquées

| Métrique (spec MVP) | Cible | Mesuré | Verdict |
| --- | --- | --- | --- |
| Bataille complète sans intervention | 12 tours | 12 tours | ✅ |
| Ordres valides au premier essai | ≥ 80 % | **46 %** | ❌ |
| Ordres finalement obtenus | 100 % | **92 %** | ❌ |
| Reproductibilité du moteur | 100 % | 100 % | ✅ |
| Coût | 0 € | 0,00 $ | ✅ |
| Aucun secret fuité | aucun | aucun | ✅ |

Les deux échecs ont la même cause unique — la saturation du palier gratuit — et
non un défaut du moteur ou des contrats. Les correctifs sont détaillés dans
l'audit QA.
