# Rapport d'exécution — bataille de référence

Statut : exécutée · Date : 2026-08-18 · Tâche kanban : `t_f4c79504`
Replay : `replays/reference.json` · Graine 42 · Ruleset `v1`
Roster mixte OpenRouter + Groq

Aucune sortie de ce rapport n'est fabriquée : tous les chiffres proviennent du
replay livré et se recalculent en le relisant.

## Issue

**Victoire de verdant** à la limite des 12 tours, 11 PV restants contre 5 à
amber. Crimson et azure éliminées. 45 appels, **0,00 $**, 7 minutes.

| Faction | PV finaux | Modèle préféré | Servi |
| --- | --- | --- | --- |
| verdant | **11** | `groq:groq/compound-mini` | 12/12 — son propre modèle, tous les tours |
| amber | 5 | `poolside/laguna-s-2.1` | 11/12 |
| crimson | 0 | `groq:openai/gpt-oss-120b` | 9/9 — son propre modèle, tous les tours |
| azure | 0 | `nvidia/nemotron-3-ultra-550b-a55b` | 5/12, replis sur `groq:compound` ×7 |

## La comparaison entre modèles est redevenue possible

C'était l'objet du défaut D1. Dans la première bataille de référence, un seul
modèle prenait 62,5 % des décisions et le modèle préféré de verdant n'était
jamais servi. Ici la répartition est plate :

| Modèle servi | Décisions | Part |
| --- | --- | --- |
| `groq:groq/compound-mini` | 12 / 45 | 26,7 % |
| `poolside/laguna-s-2.1:free` | 11 / 45 | 24,4 % |
| `groq:openai/gpt-oss-120b` | 9 / 45 | 20,0 % |
| `groq:groq/compound` | 7 / 45 | 15,6 % |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 5 / 45 | 11,1 % |
| `groq:openai/gpt-oss-20b` | 1 / 45 | 2,2 % |

Trois généraux sur quatre ont joué leur propre modèle sur la quasi-totalité de
la partie. **Aucun n'a été servi par le modèle principal d'une autre faction** —
la règle structurante du roster a tenu.

**Le point faible restant est azure.** Son modèle principal, le 550B, est aussi
le plus lent du roster (47 s mesurés) et se fait dépasser par le délai
d'expiration ; il n'a servi que 5 fois sur 12. Le repli reste un modèle
*distinct*, donc D1 ne se reproduit pas, mais la lecture des décisions d'azure
mélange deux modèles et vaut moins que celle des trois autres.

## Progression sur quatre exécutions

| Mesure | B1 origine | B2 correctifs | B3 + Groq | **B4 finale** |
| --- | --- | --- | --- | --- |
| Concentration du modèle dominant | 62,5 % | 23,7 % | 26,3 % | **26,7 %** |
| Servi au 1ᵉʳ essai | 46 % | 71 % | 87 % | **82 %** |
| Basculements sur repli | 44 % | 26 % | 8 % | **18 %** |
| Chaîne entièrement épuisée | 4 | 0 | 0 | **0** |
| Ordres finalement obtenus | 92 % | 100 % | 100 % | **100 %** |
| Attaques hors portée | 18 | 0 | 0 | **0** |
| Ordres rejetés | 2 | 0 | 4 | **0** |
| Latence médiane | 58,1 s | 23,4 s | 1,9 s | **2,9 s** |
| Durée de la bataille | ~40 min | ~28 min | 7,1 min | **~7 min** |

Les deux régressions apparentes de B4 — replis à 18 % et premier essai à 82 % —
tiennent entièrement à azure et à son modèle de 47 s. Elles restent dans la
cible.

## Déroulement tactique

| Événement | Compte |
| --- | --- |
| `MOVE_OK` | 53 |
| `ATTACK_HIT` | 19 |
| `ATTACK_MISSED` | 6 |
| `SQUAD_DESTROYED` | 5 |
| `FACTION_ELIMINATED` | 2 |
| `MOVE_BLOCKED` | 1 |
| `ORDER_REJECTED` | **0** |
| `ATTACK_OUT_OF_RANGE` | **0** |

**Zéro ordre illégal sur 58 émis, et zéro attaque gaspillée.** À comparer aux
18 attaques hors portée pour 11 coups portés de la première bataille.

La cause était la même dans les deux cas : les règles de portée et de
déplacement figuraient une fois dans le prompt système, comme règles générales à
appliquer de tête. Les énumérer **par escouade** — cibles réellement
atteignables, puis boîte de coordonnées légales — transforme une règle à
appliquer en un fait à lire. Les modèles connaissaient la règle ; ils ne
pouvaient pas l'appliquer de façon fiable.

## Reproductibilité — vérifiée sur ce replay

```
rejoue 12 tours a partir des ordres consignes uniquement
etats divergents : 0
tour final rejoue 12 == issue consignee 12 : true
VERDICT : replay REPRODUCTIBLE sans rappeler un seul modele
```

## Secrets

Balayage du replay sérialisé pour `sk-or-`, `gsk_`, `OPENROUTER`, `GROQ`,
`Bearer ` et `/home/` : **aucune occurrence**.

## Métriques du MVP — toutes atteintes

| Métrique (spec MVP) | Cible | B1 | **B4** | Verdict |
| --- | --- | --- | --- | --- |
| Bataille complète sans intervention | 12 tours | 12 | 12 | ✅ |
| Ordres valides au premier essai | ≥ 80 % | 46 % | **82 %** | ✅ |
| Ordres finalement obtenus | 100 % | 92 % | **100 %** | ✅ |
| Reproductibilité du moteur | 100 % | 100 % | 100 % | ✅ |
| Coût | 0 € | 0,00 $ | **0,00 $** | ✅ |
| Aucun secret fuité | aucun | aucun | aucun | ✅ |

Les deux métriques manquées par la première bataille sont désormais atteintes.

## Ce que Groq a réellement débloqué

La latence médiane passe de 58,1 s à 2,9 s et une bataille de 40 minutes tombe
à 7. Ce n'est pas un gain de confort : le protocole de tournoi de l'audit QA
demande plusieurs batailles par rotation d'affectation. À 40 minutes la pièce,
il était hors de portée ; à 7 minutes, une rotation complète de quatre batailles
tient en une demi-heure. **C'est ce qui rend la question de départ du projet
mesurable sans dépenser un euro.**

## Observation d'équilibrage, pas un défaut

Les batailles B2 et B3 se sont terminées en **annihilation totale** — les huit
escouades détruites au même tour. Une fois les généraux capables de viser juste,
4 dégâts contre 10 PV rend les échanges très létaux. B4 se conclut sur une
victoire nette, donc ce n'est pas systématique, mais le sujet appartient à la
phase 2 (`t_a5441071`) et non au MVP.
