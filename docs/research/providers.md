# Matrice de choix — fournisseurs LLM distants

Statut : révisé · Mesures du 2026-08-18 · Tâches kanban : `t_df6e739b`, correctif D1

> **Révision.** La première version de ce document ne retenait que les modèles
> annonçant `structured_outputs`. C'était la cause racine du défaut D1 : six
> candidats seulement, tous les replis concentrés sur deux modèles, et une
> bataille de référence décidée à 62,5 % par un seul d'entre eux. Le filtre
> était mauvais. Ce document le remplace.

## Contrainte de cadrage

Budget maximal **0 €**. Un seul fournisseur exploitable : **OpenRouter**, clé
déjà provisionnée, 16 modèles `:free` au catalogue. Groq reste écarté faute de
clé sur la machine, réévaluable en phase 2 sans toucher au code. Aucune
inférence locale sur le Raspberry Pi.

## Le filtre à ne pas appliquer

Sur les 16 modèles gratuits, **6 seulement** déclarent `response_format` ou
`structured_outputs`. Exiger cette capacité paraît prudent. C'est l'inverse.

Les 10 autres répondent parfaitement en JSON quand on le leur demande dans le
prompt — ils l'enveloppent simplement dans une clôture Markdown ou dans une
phrase. Il suffit de savoir le déballer (`packages/agents/src/json.ts`) et de
valider avec zod, ce que le moteur fait de toute façon.

Le **mode prompt est donc le défaut**, et le mode natif l'exception réservée aux
modèles qui l'honorent vraiment.

### La preuve qui tranche

`openai/gpt-oss-20b:free`, même prompt, même position, seul le mode change :

| Mode | Résultat |
| --- | --- |
| natif (`response_format: json_schema`) | **0/4** — « schema mismatch: Required », puis deux expirations à 60 s |
| prompt | **2/2** — 28,6 s et 42,8 s, deux ordres valides |

L'imposition de schéma côté serveur ne se contente pas d'être inutile pour ce
modèle : elle le casse. Le classer « incapable de JSON structuré » aurait été
faux, exactement comme l'était le diagnostic de troncature de la première passe.

## Résultats mesurés — 12 modèles, position de tour 5

Sondés à travers le vrai `OpenRouterProvider`, avec les mêmes plafonds qu'en
production, sur une position de **milieu de partie** et non de déploiement — le
premier sondage sur un prompt de tour 1 avait sous-estimé le budget de tokens.

| Modèle (`:free`) | Mode | Valide | Latence | Verdict |
| --- | --- | --- | --- | --- |
| `poolside/laguna-s-2.1` | prompt | 1/1 | 4,5 s | **Le plus rapide du catalogue.** |
| `google/gemma-4-26b-a4b-it` | natif | 2/2 | 4,0 – 8,2 s | Fiable. Une expiration isolée, non reproduite. |
| `nvidia/nemotron-3-nano-30b-a3b` | prompt | 1/1 | 7,1 s | Fiable. |
| `nvidia/nemotron-3-super-120b-a12b` | natif | 1/1 | 13,2 s | Fiable. |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | prompt | 1/1 | 14,9 s | Fiable. |
| `poolside/laguna-xs-2.1` | prompt | 1/1 | 22,2 s | Fiable. |
| `nvidia/nemotron-3.5-lightning` | prompt | 1/1 | 22,6 s | Fiable. 1 M de contexte. |
| `openai/gpt-oss-20b` | prompt | 2/2 | 28,6 – 42,8 s | Fiable **en mode prompt uniquement**. |
| `nvidia/nemotron-3-ultra-550b-a55b` | prompt | 1/1 | 47,3 s | Fiable. Le plus gros modèle gratuit, 1 M de contexte. |
| `google/gemma-4-31b-it` | natif | 0/3 | — | **Écarté.** HTTP 429 sur trois tentatives. |
| `z-ai/glm-5.2` | prompt | 0/3 | — | **Écarté.** HTTP 429 sur trois tentatives, malgré un intérêt réel. |
| `cohere/north-mini-code` | prompt | 0/3 | 60 s | **Écarté.** Expiration systématique. |

Écartés sans nouveau sondage, sur les mesures précédentes :
`liquid/lfm-2.5-2.6b` (207–213 s par ordre), `dots-studio/dots-3-note-preview`
(tronque systématiquement), `nvidia/nemotron-3.5-content-safety` (pas un modèle
généraliste), `nvidia/nemotron-nano-12b-v2-vl` (variante vision, sans intérêt
ici).

**Neuf modèles fiables sur quatre éditeurs** — contre deux auparavant.

## Trois contraintes que les mesures imposent

### 1. Le budget de sortie doit couvrir les tokens de raisonnement

Une première passe à `max_tokens: 800` donnait 0/2 presque partout, et le
diagnostic « ces modèles ne savent pas produire du JSON » était faux : ces
modèles émettent des tokens de raisonnement facturés sur le budget de complétion
avant d'écrire la moindre accolade. 3000 a réglé le cas du tour 1 — puis la
troncature est réapparue en milieu de bataille, où la position est plus riche.

**Règle retenue :** `max_tokens` à **6000**. Un `finish_reason: length` est
traité comme un échec réessayable, jamais comme une réponse invalide, sinon le
diagnostic repart dans la mauvaise direction.

### 2. Le HTTP 429 est le régime nominal, pas l'exception

Sur le palier gratuit, la limitation de débit est l'état normal, et elle se
manifeste autant en expirations qu'en 429 explicites.

**Règle retenue :** chaîne de repli ordonnée par général, backoff exponentiel
borné, puis bascule. Si toute la chaîne échoue, l'escouade reçoit un `HOLD`
étiqueté et journalisé — **jamais un ordre inventé côté client**.

### 3. Un délai d'expiration par requête

Latences observées de 4,5 s à 60 s (plafond), et jusqu'à 213 s sur les modèles
écartés. Sans plafond, une seule escouade fige une bataille entière.

**Règle retenue :** 60 s par requête, traité comme un 429.

## Affectation des quatre généraux

Règle structurante, issue de D1 : **le premier repli d'une faction n'est jamais
le modèle principal d'une autre.** Un modèle qui tombe ne peut donc pas
transformer un général en copie d'un autre — ce qui est précisément ce qui avait
ruiné la première bataille de référence.

| Faction | Modèle principal | Mode | Replis |
| --- | --- | --- | --- |
| Crimson | `google/gemma-4-26b-a4b-it` | natif | `nemotron-3-nano-omni-reasoning`, `nemotron-3.5-lightning` |
| Azure | `nvidia/nemotron-3-ultra-550b-a55b` | prompt | `nemotron-3-super`, `nemotron-3-nano-30b` |
| Verdant | `openai/gpt-oss-20b` | prompt | `laguna-xs-2.1`, `nemotron-3.5-lightning` |
| Amber | `poolside/laguna-s-2.1` | prompt | `nemotron-3-nano-30b`, `gemma-4-26b` |

Quatre éditeurs distincts en tête de chaîne : Google, NVIDIA, OpenAI, Poolside.

Neuf modèles fiables ne peuvent pas remplir douze emplacements de façon
disjointe : `gemma-4-26b` apparaît une fois en dernier recours chez amber. Cet
emplacement n'est atteint que si un principal **et** un premier repli ont tous
deux échoué.

## Interface fournisseur

L'orchestrateur ne connaît qu'un contrat, `OrderProvider`. Deux
implémentations : `OpenRouterProvider` pour les appels réels et
`ScriptedProvider` pour les tests déterministes, qui ne touche aucun réseau.
Le choix entre mode natif et mode prompt est interne au provider et piloté par
`NATIVE_SCHEMA_MODELS`. Ajouter Groq en phase 2 revient à écrire une troisième
implémentation sans toucher au moteur ni au lecteur.

## Politique de données

Les modèles `:free` d'OpenRouter sont servis sous une politique d'entraînement
sur les invites. Les prompts ne contiennent que l'état public du champ de
bataille — aucun secret, aucune donnée personnelle, aucun contenu de `.env`. La
clé circule uniquement dans l'en-tête `Authorization` et n'est jamais
journalisée dans les replays. Un test échoue si un prompt contient `sk-or-`,
`OPENROUTER` ou un chemin `/home/`.
