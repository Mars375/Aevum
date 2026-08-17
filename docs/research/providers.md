# Matrice de choix — fournisseurs LLM distants

Statut : validé · Date des mesures : 2026-08-17 · Tâche kanban : `t_df6e739b`

## Contrainte de cadrage

Le GATE fixe un budget maximal de **0 €**. Cela élimine d'office tout modèle
payant et réduit le champ à un seul fournisseur exploitable aujourd'hui :

| Fournisseur | Retenu | Motif |
| --- | --- | --- |
| **OpenRouter** | ✅ | Clé déjà provisionnée dans l'environnement (`OPENROUTER_API_KEY`). 17 modèles portant le suffixe `:free` sur 414 au catalogue. Une seule intégration HTTP couvre tous les modèles. |
| Groq | ❌ | Aucune clé disponible sur la machine. L'obtenir demanderait une inscription hors périmètre du lancement. Réévaluable en phase 2 sans changer le code : l'interface fournisseur est agnostique. |
| Together, Fireworks, DeepInfra | ❌ | Pas d'offre gratuite pérenne, incompatible avec le budget 0 €. |
| Ollama, llama.cpp, tout modèle local | ⛔ | **Interdit par contrainte ferme.** Le Raspberry Pi n'exécute aucune inférence. |

## Protocole de mesure

Chaque modèle candidat a reçu deux fois un prompt de décision tactique réaliste
(une faction, deux escouades, deux ennemis visibles, tour 1 sur 12) avec un
`response_format` de type `json_schema` en mode `strict`. Une réponse est
comptée valide seulement si elle parse en JSON **et** contient exactement deux
ordres dont l'`action` appartient à l'énumération et dont la cible porte des
coordonnées entières. Script : `scripts/probe-providers.ts`.

## Résultats mesurés

| Modèle (`:free`) | Valide | Latence observée | Tokens totaux | Verdict |
| --- | --- | --- | --- | --- |
| `google/gemma-4-26b-a4b-it` | **2/2** | 3,7 – 5,0 s | 423 – 499 | **Primaire.** Le plus rapide et de loin le plus économe : pas de dépense en tokens de raisonnement. |
| `nvidia/nemotron-3-super-120b-a12b` | **2/2** | 9,1 – 13,5 s | 897 – 990 | **Secondaire.** Fiable, raisonnement modéré, décisions tactiques plus étoffées. |
| `openai/gpt-oss-20b` | 1/2 | 17,8 s | 1139 | Utilisable en repli. Le second appel a été refusé en HTTP 429. |
| `nvidia/nemotron-nano-9b-v2` | 1/2 | 36 – 82 s | 1609 – 3156 | Marginal. Lent et irrégulier ; épuise parfois le budget de sortie. |
| `dots-studio/dots-3-note-preview` | 0/2 | 22,1 – 22,5 s | 3149 | **Écarté.** Consomme la totalité du budget en raisonnement et tronque systématiquement le JSON. |
| `google/gemma-4-31b-it` | 0/2 | — | 0 | **Écarté.** HTTP 429 sur les deux tentatives, jamais joignable. |
| `liquid/lfm-2.5-2.6b` | 0/2 | 207 – 213 s | 3150 | **Écarté.** Latence rédhibitoire, plus de 3 minutes par ordre. |

## Trois conclusions qui contraignent l'implémentation

### 1. Le budget de sortie doit couvrir les tokens de raisonnement

Une première passe à `max_tokens: 800` donnait 0/2 sur presque tous les modèles.
Le diagnostic initial « ces modèles ne savent pas produire du JSON structuré »
était faux. La cause réelle est la troncature : ces modèles émettent des tokens
de raisonnement facturés sur le budget de complétion avant d'écrire la moindre
accolade. Un prompt trivial (`Reply with JSON: {"ok":true}`) consomme déjà
77 tokens de raisonnement pour 4 tokens de contenu.

Porter `max_tokens` à 3000 a fait passer `nemotron-3-super` de 0/2 à 2/2 sans
aucune autre modification.

**Règle retenue :** `max_tokens` minimum de 3000 par appel d'ordre. Le
`finish_reason` doit être inspecté ; une valeur `length` est traitée comme un
échec réessayable et non comme une réponse invalide, sans quoi le diagnostic
repart dans la mauvaise direction.

### 2. Le HTTP 429 est le mode de défaillance nominal, pas l'exception

Deux modèles sur sept ont été limités pendant une campagne de quatorze appels
seulement. Sur le palier gratuit, la limitation de débit est le régime normal.

**Règle retenue :** chaque général déclare une chaîne de repli ordonnée, pas un
modèle unique. Un 429 déclenche un backoff exponentiel borné puis une bascule
vers le modèle suivant de la chaîne. Un ordre n'est jamais inventé côté client :
si toute la chaîne échoue, l'escouade reçoit un ordre `HOLD` explicitement
étiqueté comme repli, et l'événement est journalisé dans le replay.

### 3. La dispersion de latence impose un délai d'expiration par requête

L'écart va de 3,7 s à 213 s, soit un facteur 57. Sans plafond, une seule
escouade peut geler une bataille entière.

**Règle retenue :** délai d'expiration de 60 s par requête. Un dépassement est
traité comme un 429 et bascule sur le repli suivant.

## Affectation recommandée des quatre généraux

Chaque faction reçoit un modèle préféré distinct — la diversité des modèles est
une propriété recherchée, elle rend les batailles intéressantes — et retombe sur
les deux modèles éprouvés quand le quota se ferme.

| Faction | Modèle préféré | Chaîne de repli |
| --- | --- | --- |
| Crimson | `google/gemma-4-26b-a4b-it:free` | `nvidia/nemotron-3-super-120b-a12b:free` |
| Azure | `nvidia/nemotron-3-super-120b-a12b:free` | `google/gemma-4-26b-a4b-it:free` |
| Verdant | `openai/gpt-oss-20b:free` | `google/gemma-4-26b-a4b-it:free`, puis `nvidia/nemotron-3-super-120b-a12b:free` |
| Amber | `nvidia/nemotron-nano-9b-v2:free` | `nvidia/nemotron-3-super-120b-a12b:free`, puis `google/gemma-4-26b-a4b-it:free` |

Les modèles écartés (`dots-3-note-preview`, `gemma-4-31b-it`, `lfm-2.5-2.6b`)
sont exclus de toute chaîne.

## Interface fournisseur

L'orchestrateur ne connaît qu'un contrat, `OrderProvider`, qui reçoit une vue
locale et un schéma et rend un ordre validé accompagné de sa télémétrie
(modèle réellement servi, tokens, latence, nombre de tentatives). Deux
implémentations existent : `OpenRouterProvider` pour les appels réels et
`ScriptedProvider` pour les tests déterministes, qui ne touche aucun réseau.
Ajouter Groq en phase 2 revient à écrire une troisième implémentation sans
modifier ni le moteur ni le lecteur de replay.

## Politique de données

Les modèles `:free` d'OpenRouter sont servis sous une politique d'entraînement
sur les invites. Aucun secret, aucune donnée personnelle et aucun contenu de
`.env` ne transite dans les prompts : ceux-ci ne contiennent que l'état public
du champ de bataille. La clé API circule uniquement dans l'en-tête
`Authorization` et n'est jamais journalisée dans les replays.
