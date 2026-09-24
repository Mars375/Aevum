# Banc des modèles gratuits — ce qui est stable et propre pour nos tests

La question : parmi tous les modèles gratuits qu'on peut trouver, lequel
gouverne une campagne **sans tomber** (stable) et **sans ordres rejetés**
(propre) ? La réponse, mesurée de bout en bout par le chemin du produit :

> **`kilo:dots-studio/dots-3-note-preview:free`** — 40 tours distants
> consécutifs sur 40, en 40 requêtes sans une relance, **un seul ordre
> rejeté**, 5,2 s de médiane, rejeu vérifié. **Sans clé ni compte.**

C'est désormais **le modèle par défaut**, choisi parmi les seuls modèles retenus
(`packages/agents/src/stable-models.ts`) — voir « Le 24 septembre » plus bas.

## La méthode : apparier, puis durer

Jouer une campagne par modèle ne compare rien : chaque partie diverge dès le
premier tour. `npm run bench:models` fige **six situations** — reproduites à
l'identique par le dirigeant local, deux graines, début et milieu de partie —
et les soumet toutes à chaque modèle. Chaque conseil passe par le chemin du
produit : même prompt, même observation, même lecture, même passe de
correction, même délai de 45 s. Seule la destination de l'appel change ; la
sortie structurée et le bridage du raisonnement suivent ce que le catalogue du
modèle déclare.

Puis `--consecutive=20` : **vingt tours réellement joués d'affilée**, trois
essais par tour. Les deux épreuves ne disent pas la même chose, et c'est tout
leur intérêt — voir `ling-3.0-flash-sante` plus bas.

## Ce qui a été trouvé

| source                       | clé ?          | résultat                                                                     |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------- |
| Nous (7 gratuits)            | la nôtre       | 5 utilisables ; `step-3.7-flash` et `solar-pro4` refusés (« missing tags »)  |
| **Kilo** (23 gratuits)       | **aucune**     | **officiel** : 200 requêtes/h par IP, modèles `:free` seulement              |
| OVHcloud AI Endpoints        | aucune         | 429 dès la première requête, sur les 9 modèles essayés                       |
| LLM7                         | —              | n'est plus sans clé (401) ; liste en outre des modèles propriétaires, écarté |
| Pollinations                 | aucune         | un seul modèle opaque (`openai-fast`), écarté                                |
| OpenCode Zen, gratuits       | celle d'Hermes | **403** : « réservé à l'usage depuis OpenCode » — exclu, sans contournement  |
| OpenCode Go                  | celle d'Hermes | payant ; « conçu pour les agents de code », trafic surveillé — non utilisé   |
| **local** (Ollama, RTX 5070) | aucune         | installé ; `qwen2.5:7b`, `ministral-3:8b`, `gemma3:12b`, contexte 16 384     |

OpenCode Go demande surtout une décision qui n'est pas la mienne : son
abonnement est celui d'Hermes, et la documentation prévient que le trafic qui
ne ressemble pas à celui d'un agent de code peut faire couper le compte. Aucune
requête de jeu n'y a été envoyée. **Décision prise ensuite : abandonné.**

## Six situations, seize modèles

| modèle                        |  répond | valide du 1er coup | rejets | hors options |   médiane |
| ----------------------------- | ------: | -----------------: | -----: | -----------: | --------: |
| nous · `longcat-2.0`          |     6/6 |                  5 |      1 |            0 |    10,0 s |
| nous · `laguna-s-2.1`         |     6/6 |                  2 |      0 |            0 |    29,0 s |
| nous · `laguna-xs-2.1`        |     6/6 |                  0 |      9 |            1 |    15,4 s |
| nous · `ling-3.0-flash-fin`   |     0/6 |                  — |      — |            — |         — |
| nous · `ling-3.0-flash-sante` |     6/6 |                  2 |      0 |            0 |     7,0 s |
| kilo · `nemotron-3-ultra`     |     4/6 |                  2 |      1 |            1 |    34,3 s |
| kilo · `nemotron-3-super`     |     4/6 |                  2 |      2 |            0 |    13,2 s |
| **kilo · `dots-3-note`**      | **6/6** |              **5** |  **1** |            1 | **7,6 s** |
| kilo · `nex-n2.5-pro`         |     1/6 |                  0 |      1 |            0 |    44,3 s |
| kilo · `nex-n2.5-mini`        |     6/6 |                  3 |      1 |            0 |     5,9 s |
| kilo · `step-3.7-flash`       |     0/6 |                  — |      — |            — |         — |
| kilo · `ling-3.0-flash-fin`   |     5/6 |                  0 |      3 |            2 |     4,3 s |
| kilo · `lfm-2.5-2.6b`         |     0/6 |                  — |      — |            — |         — |
| local · `qwen2.5:7b`          |     6/6 |                  1 |      3 |            1 |    13,3 s |
| local · `ministral-3:8b`      |     6/6 |                  1 |      3 |            1 |    16,4 s |
| local · `gemma3:12b`          |     6/6 |                  3 |      3 |            2 |    14,6 s |

Les absences ont chacune une cause, et aucune n'est un hasard :

- **refus du fournisseur** — `ling-3.0-flash-fin` chez Nous rejette le schéma
  structuré du conseil (sans lui, il ne rend pas de JSON lisible) ; `lfm-2.5`
  refuse la requête à chaque fois ;
- **délai de 45 s dépassé** — `step-3.7-flash` six fois sur six, `nex-n2.5-pro`
  cinq sur six ;
- **réponses vides intermittentes** — les deux `nemotron` ;
- un résultat de `laguna-s` tombé sur une limite de débit a été **remesuré** :
  une limite du fournisseur ne dit rien du modèle.

Un modèle local charge ses poids en mémoire graphique au premier appel ; ce
chargement a dépassé une fois les 45 s et comptait comme un échec du modèle. Le
banc l'échauffe désormais hors mesure.

## Vingt tours d'affilée

| modèle                        |    servis | relancés | perdus | valides du 1er coup | rejets | médiane |
| ----------------------------- | --------: | -------: | -----: | ------------------: | -----: | ------: |
| **kilo · `dots-3-note`**      | **20/20** |        0 |      0 |              **19** |  **1** |   7,3 s |
| kilo · `nex-n2.5-mini`        |     20/20 |        0 |      0 |                  13 |      3 |   6,7 s |
| nous · `ling-3.0-flash-sante` |     20/20 |        0 |      0 |                   1 |     15 |   7,0 s |
| nous · `longcat-2.0`          |     17/20 |        3 |      3 |                  15 |      1 |  10,1 s |
| local · `gemma3:12b`          |     20/20 |        0 |      0 |                   7 |     13 |  13,7 s |

Deux lectures que les situations isolées ne permettaient pas :

- **`ling-3.0-flash-sante` était propre en situations isolées — zéro rejet — et
  se dégrade en partie réelle** : quinze rejets en vingt tours, dont quatorze
  sont le même grenier refusé, redemandé de tour en tour. Le défaut de
  `laguna` la veille, exactement.
- **`longcat` reste le plus soigneux quand il répond, et perd un tour sur
  sept** — trois fois, relances comprises. Son raisonnement sans fin sur
  certaines requêtes (`docs/reports/fournisseurs.md`) n'est pas un accident.

Le modèle local est le seul qui ne peut **pas** tomber : aucun quota, aucun
fournisseur. Il reste loin derrière en propreté.

**Décision : on reste sur des modèles cloud.** Une carte de 12 Go ne fait tourner
que des modèles de 7 à 12 milliards de paramètres, et le meilleur a eu treize
fois plus d'ordres rejetés que `dots-3-note`. Ollama et ses modèles ont été
désinstallés. Le banc garde sa cible `ollama:` : si une machine plus puissante
changeait la donne, la mesure se refait en une commande.

## De bout en bout, par le chemin du produit

Le banc redirige un appel ; une campagne passe par `RemoteProvider`, qui ne
connaissait pas Kilo. Il a fallu l'ajouter — et **la première campagne s'est
arrêtée au premier tour**, là où le banc avait réussi vingt fois sur vingt.

La différence tenait en un champ. Le chemin Nous envoie
`reasoning: { effort: "none" }` quand le modèle le déclare ; `RemoteProvider`
ne l'envoyait jamais. Même conseil, seul ce champ changeant : **plus de 45 s
sans lui, 6 s avec** — 398 jetons, décision valide. La leçon de `longcat`
revient par une autre porte : un modèle qui raisonne doit en être empêché, ou
il raisonne au-delà de tout délai. `REASONING_OFF_MODELS` le fait désormais
pour les seuls modèles mesurés — un fournisseur qui ne connaît pas le champ
pourrait refuser l'appel.

Relancée :

|                               |                                 |
| ----------------------------- | ------------------------------- |
| tours joués                   | **40/40**                       |
| requêtes                      | **40** — aucune relance         |
| servis par le modèle lui-même | **40**                          |
| ordres rejetés                | **1** — 39 tours sans           |
| latence                       | 3,4 s à 8,7 s, 5,2 s en médiane |
| rejeu                         | vérifié                         |

(`docs/reports/remote-campaign-kilo.json`)

## Le 24 septembre : tout le catalogue, puis la sélection

La consigne était claire : ne retenir, pour nos tests, que des modèles stables —
et tous les chercher. Les critères ont été **écrits avant la mesure** :

| étape                          | retenu si…                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------- |
| 1. crible                      | répond à une petite requête (second essai à 90 s en cas de 429 ou de délai)       |
| 2. banc apparié, 6 situations  | au moins 5 réponses, 3 valides du premier coup, médiane de 20 s au plus           |
| 3. durée, 20 tours consécutifs | 20/20 sans tour perdu, 14 valides du premier coup, 4 rejets au plus, 15 s au plus |

**Crible : 25 modèles gratuits** au catalogue du jour, 8 chez Nous, 17 chez Kilo,
tous essayés — seuls les routeurs automatiques, la musique et la modération
écartés. 17 répondent. Tombent : `step-3.7-flash`, `solar-pro4` et le nouveau
`space-bunny-alpha` chez Nous (400) ; `qwen3.8-27b`, `inkling-small` et `glm-5.2`
chez Kilo, saturés même au second essai ; `lfm-2.5` et `nemotron-nano-omni`, qui
**imposent** le raisonnement.

**Banc** — les modèles déjà mesurés la veille gardent leur résultat ; six
nouveaux passent l'épreuve (`model-bench-2.json`), plus les deux qui imposent le
raisonnement, cette fois autorisés à raisonner (`--raisonnement-impose`) :

| modèle                          | répond | 1er coup | pourquoi il ne passe pas                                |
| ------------------------------- | -----: | -------: | ------------------------------------------------------- |
| kilo · `laguna-s-2.1`           |    4/6 |        1 | 429 du fournisseur en amont, à deux reprises            |
| kilo · `laguna-xs-2.1`          |    3/6 |        3 | 429 du fournisseur en amont, à trois reprises           |
| kilo · `ling-3.0-flash-sante`   |    6/6 |        2 | un conseil valide du premier coup de moins que le seuil |
| kilo · `north-mini-code`        |    6/6 |        2 | idem, et 4 ordres rejetés                               |
| kilo · `nemotron-3.5-lightning` |    0/6 |        0 | délai dépassé six fois                                  |
| kilo · `step-3.7-flash`         |    0/6 |        0 | vide ou délai dépassé                                   |
| kilo · `lfm-2.5-2.6b`           |    1/6 |        0 | laissé raisonner : 53 s, puis délais                    |
| kilo · `nemotron-3-nano-omni`   |    0/6 |        0 | idem                                                    |

Les 429 de `laguna` ne sont pas la limite de notre adresse : les autres modèles
passaient au même moment. C'est son fournisseur qui sature — pour nos tests,
une vraie instabilité.

**Durée**, seconde mesure, un jour après la première :

| modèle            | jour 1                      | jour 2                                | sur 40 tours                          |
| ----------------- | --------------------------- | ------------------------------------- | ------------------------------------- |
| **`dots-3-note`** | 20/20, 19 valides, 1 rejet  | **20/20, 18 valides, 0 rejet**, 5,2 s | 40/40, **37 valides (93 %)**, 1 rejet |
| `nex-n2.5-mini`   | 20/20, 13 valides, 3 rejets | 20/20, 15 valides, 2 rejets, 5,0 s    | 40/40, 28 valides (70 %), 5 rejets    |

`nex-n2.5-mini` échouait de justesse le premier jour et passe le second ; sur
les quarante tours il est pile au seuil. **Retenu, comme second choix et de
justesse** — écrit tel quel dans le code.

**La sélection vit à un seul endroit** : `packages/agents/src/stable-models.ts`,
chaque modèle avec la mesure qui le justifie. Le modèle par défaut des quatre
dirigeants en découle : **`dots-3-note-preview` remplace `longcat-2.0`**, qui
perd un tour sur sept en durée. `stable-models.test.ts` rend bruyant tout retour
à un modèle non retenu, et vérifie que chaque modèle retenu est servi comme il a
été mesuré — gratuit, sans clé, sortie structurée native, raisonnement bridé.

Un test du serveur supposait qu'une partie distante sans clé tombe forcément en
panne. Avec un défaut sans clé, il envoyait une vraie requête sur le réseau ; il
vérifie désormais ce chemin sur un modèle qui exige une clé absente.

La partie à quatre modèles de la veille (`partie-quatre-modeles`, 66 tours) a été
arrêtée : elle mettait délibérément deux modèles instables en jeu. Une partie
avec les seuls modèles retenus la remplace — `dots-3-note` pour Ambre et
Pourpre, `nex-n2.5-mini` pour Azur et Sylve.

## Les autres plateformes

**Sans clé, il ne reste presque rien.** OVH répond 429 en 0,1 s à tout appel
anonyme, deux jours de suite : fermé pour notre adresse. OpenCode Zen réserve
ses modèles gratuits à son application. Pollinations n'offre qu'un modèle opaque.

**LLM7** sert encore quatre modèles sans clé — le seul palier qui n'exige pas de
compte payant : `mistral-Nemo`, `codestral`, `minimax-m2.7`, `GLM-5.3-Flash`.
Au banc, **zéro conseil réussi sur six pour chacun** : sa limite de 60 requêtes
par heure dépassée malgré une minute d'écart, des réponses hors format, des
délais. Un détail inquiétant s'est révélé anodin : `GLM-5.3-Flash` renvoyait,
après son JSON, du JavaScript obfusqué (`eval(function(p,a,c,k,e,d)…`). Déplié
sans être exécuté, il se réduit à `const alphabet="the quick brown fox…"` — le
modèle recrache ses données d'entraînement, l'intermédiaire n'injecte rien.
Mais une réponse suivie de texte parasite reste illisible pour le conseil.

**Une mesure indépendante confirme la sélection.** KiloStats sonde chaque heure
les modèles gratuits de Kilo (79 passages en deux semaines) : sur sept jours,
`dots-3-note` est disponible **95 %** du temps, `nex-n2.5-mini` **90 %** — parmi
les plus disponibles. Les `laguna` (60 et 50 %), `qwen3.8`, `glm-5.2` et
`inkling` (5 à 12 %) confirment nos échecs. Une nuance : 95 %, c'est une requête
sur vingt qui échoue — une partie de 480 tours en rencontrera, et les essais
répétés de la sonde sont là pour ça. KiloStats ne mesure que la disponibilité
sur une question triviale : `step-3.7-flash` y est à 95 % et échoue sur nos
conseils. Le banc reste indispensable.

**Avec un compte gratuit** — à créer par l'utilisateur, les clés ne passent
jamais par la session :

| plateforme       | gratuit (annoncé)                            | pour Aevum                                                    |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Mistral          | ~1 milliard de jetons par mois               | le plus intéressant ; déjà dans le code                       |
| OpenRouter       | 50 requêtes/jour ; 1 000 après 10 $ une fois | héberge aussi `dots-3-note` : une seconde route si Kilo tombe |
| Cerebras         | 1 million de jetons par jour                 | ~65 conseils par jour : tests, pas une partie entière         |
| NVIDIA NIM       | 1 000 à 5 000 crédits                        | une réserve qui s'épuise                                      |
| Groq             | 8 000 jetons par minute                      | inutilisable : un conseil en fait 9 200                       |
| Google AI Studio | 20 requêtes par jour                         | trop peu                                                      |

Les clés posées, les deux plateformes ont été mesurées — section suivante.

## OpenRouter et Mistral, mesurés le même jour

Les deux clés posées, les deux catalogues gratuits sont passés par les mêmes
trois étapes, avec les mêmes critères. La clé OpenRouter a déjà servi un achat :
elle a droit à 1 000 requêtes gratuites par jour, et le banc refuse tout modèle
qui n'est pas `:free`.

**Crible, 26 modèles** (19 OpenRouter `:free` — le classifieur
`nemotron-3.5-content-safety` écarté —, 7 Mistral). Onze répondent du premier
coup ; les délais et les 429 ont eu leur second essai, 90 s plus tard.

- `laguna-s-2.1` et `laguna-xs-2.1`, saturés chez Nous et Kilo, répondent par
  OpenRouter au second essai.
- `mistral-small`, `mistral-medium`, `magistral-small` et `magistral-medium`
  répondent 429 à chaque fois. Ce n'est pas une saturation : l'en-tête dit
  `x-ratelimit-limit-req-minute: 0`, ces modèles sont fermés à cette clé.
- `inkling` et `inkling-small` : 403. `lfm-2.5` : 400. `qwen3.8`, `glm-5.2`,
  `gemma-4` (deux tailles) : 429 aux deux essais. `nex-n2.5-pro`,
  `nemotron-3.5-lightning` : délai dépassé aux deux essais.

**Banc apparié, 6 situations** (au moins 5 réponses, 3 valides du premier coup) :

| modèle                                  | répond | 1er coup | rejets | médiane | verdict |
| --------------------------------------- | -----: | -------: | -----: | ------: | ------- |
| `openrouter:dots-3-note-preview:free`   |    6/6 |        5 |      1 |   1,3 s | passe   |
| `openrouter:nemotron-3-super-120b:free` |    5/6 |        4 |      1 |   0,6 s | passe   |
| `mistral:codestral-latest`              |    6/6 |        4 |      0 |   4,6 s | passe   |
| `openrouter:nex-n2.5-mini:free`         |    6/6 |        3 |      1 |   2,1 s | passe   |
| `openrouter:ling-3.0-flash-sante:free`  |    6/6 |        2 |      3 |   1,9 s | non     |
| `openrouter:nemotron-3-ultra:free`      |    4/6 |        2 |      1 |   0,9 s | non     |
| `mistral:ministral-8b-latest`           |    4/6 |        2 |      2 |    10 s | non     |
| `openrouter:laguna-s-2.1:free`          |    4/6 |        1 |      5 |   1,2 s | non     |
| `mistral:ministral-14b-latest`          |    3/6 |        2 |      1 |     8 s | non     |
| `openrouter:nemotron-3-nano-omni:free`  |    3/6 |        3 |      0 |   0,4 s | non     |
| `openrouter:ling-3.0-flash-fin:free`    |    6/6 |        0 |      2 |   2,2 s | non     |
| `openrouter:north-mini-code:free`       |    6/6 |        0 |      8 |   1,1 s | non     |
| `openrouter:laguna-xs-2.1:free`         |    0/6 |        0 |      — |       — | non     |

Les deux `ministral` renvoient un JSON illisible sur deux situations de milieu
de partie : en mode prompt, sans schéma imposé, ils ne tiennent pas le format.

**Durée, 20 tours d'affilée** (20/20, 14 valides du premier coup, 4 rejets au
plus, médiane de 15 s au plus) :

| modèle                                  | tours | 1er coup | rejets | relances | médiane | verdict |
| --------------------------------------- | ----: | -------: | -----: | -------: | ------: | ------- |
| `mistral:codestral-latest`              | 20/20 |       19 |      0 |        0 |   5,1 s | passe   |
| `openrouter:dots-3-note-preview:free`   | 20/20 |       17 |      1 |        0 |   1,3 s | passe   |
| `openrouter:nex-n2.5-mini:free`         | 20/20 |        7 |      3 |        0 |   2,1 s | non     |
| `openrouter:nemotron-3-super-120b:free` | 20/20 |        5 |      5 |        5 |   1,2 s | non     |

`nex-n2.5-mini` fait 7/20 par OpenRouter contre 13 et 15 par Kilo : le même
modèle, servi par un autre hébergeur, n'est pas le même candidat. Seule la route
Kilo reste retenue.

**Par le chemin du produit, 12 tours chacun** (`remote-campaign-probe`) :
`codestral` 12/12 servis par lui-même, 1 rejet, médiane 4,8 s ; `dots-3-note`
par OpenRouter 12/12, 1 rejet, médiane 5,1 s. Rejeu vérifié pour les deux.

Ce dernier contrôle a trouvé un défaut que le banc ne pouvait pas voir : le
produit envoyait `openrouter:dots-studio/…` **tel quel**, préfixe compris, et
OpenRouter refusait l'identifiant — trois essais, trois échecs au premier tour.
Le banc, qui retire le préfixe lui-même, mesurait 20/20. `parseModelRef`
accepte désormais le préfixe explicite, testé, et `stable-models.test.ts`
confronte chaque modèle retenu à ce que le produit envoie réellement.

**La liste retenue** (`packages/agents/src/stable-models.ts`) :

| rôle         | modèle                                            | clé                  |
| ------------ | ------------------------------------------------- | -------------------- |
| principal    | `kilo:dots-studio/dots-3-note-preview:free`       | aucune               |
| second choix | `mistral:codestral-latest`                        | `MISTRAL_API_KEY`    |
| secours      | `openrouter:dots-studio/dots-3-note-preview:free` | `OPENROUTER_API_KEY` |
| second choix | `kilo:nex-agi/nex-n2.5-mini:free`                 | aucune               |

`codestral` est le meilleur mesuré du jour — 19/20 du premier coup, zéro rejet —
mais sur **un seul jour**, là où `dots` et `nex-mini` en ont deux. Il n'est pas
promu principal pour autant : le principal doit tourner sans clé.

**Ce que ce passage ne prouve pas.** La gratuité de Mistral est une propriété du
compte, pas du modèle : rien dans l'API ne dit qu'une clé est au palier gratuit.
Les limites à zéro sur les modèles `medium` et `magistral` y ressemblent ; la
facturation, elle, n'a pas été vérifiée ici.

## La partie longue avec les seuls retenus

480 tours consécutifs, graine 42, `spectator-10`, par le chemin du produit :
`dots-3-note` pour amber et crimson, `nex-n2.5-mini` pour azure et verdant,
tous deux par Kilo, sans clé (`partie-modeles-stables.json`).

| civilisation | modèle          | servis par lui-même | remplacés | ordres rejetés |
| ------------ | --------------- | ------------------: | --------: | -------------: |
| amber        | `dots-3-note`   |             119/120 |         1 |             20 |
| crimson      | `dots-3-note`   |             120/120 |         0 |              0 |
| azure        | `nex-n2.5-mini` |             120/120 |         0 |              9 |
| verdant      | `nex-n2.5-mini` |             120/120 |         0 |             14 |

**479 tours sur 480 servis par le modèle lui-même**, un seul joué par le
dirigeant local — compté comme tel —, quatre relances de transport, 440 tours
sans aucun rejet, médiane 4,7 s, **rejeu vérifié**. Les quatre dirigeants sont
classables. La campagne précédente, avec `longcat-2.0` parmi les quatre, s'était
arrêtée à 66 tours.

Même modèle, même partie : `dots-3-note` fait 20 rejets pour amber et zéro pour
crimson. L'écart vient de la situation de chaque civilisation, pas du modèle —
une seule partie ne permet pas d'en dire plus.

## Ce que la première partie en direct a appris

Tour 112 d'une partie à quatre modèles, `dots-3-note` par Kilo pour Ambre : dix
essais sans réponse en un quart d'heure, et le direct s'est suspendu comme prévu.
La cause n'était pas « réponse vide », comme le disait le message, mais un **HTTP
400 de l'hébergeur du modèle, AtlasCloud**, sur un conseil de 12 141 jetons
d'entrée.

- **Intermittent, pas déterministe.** Le même corps, renvoyé tel quel, échoue et
  passe selon les essais ; la valeur de `max_tokens` n'y fait rien de monotone
  (100 passe, 60 échoue). Ni le schéma imposé, ni le raisonnement bridé ne sont
  en cause ; un texte neutre de même longueur passe toujours. Relancé, le direct
  a franchi ce tour et continué.
- **La route de secours n'est pas indépendante.** `dots-3-note` par OpenRouter
  aboutit au même hébergeur, et échoue sur le même conseil. Elle protège d'une
  panne de la passerelle Kilo, pas de celle d'AtlasCloud — c'est écrit dans
  `stable-models.ts`.
- Le message d'erreur dit désormais ce que le fournisseur a répondu (`HTTP 400`)
  au lieu de « réponse vide ».

## Le conseil allégé : de 0 sur 10 à 10 sur 10

Le direct s'est suspendu une seconde fois, au tour 132, toujours sur Ambre. Le
conseil qui échouait a été renvoyé tel quel et allégé, en alternance, dix fois
chacun, espacés de 19 s, sur l'état exact de l'échec :

| conseil                                   | caractères | réponses |
| ----------------------------------------- | ---------: | -------: |
| tel quel                                  |     34 658 |     0/10 |
| allégé de quatre redondances              |     23 386 |    10/10 |
| allégé de trois, contrat de réponse gardé |     27 012 |    10/10 |

Le contrat de réponse est gardé : c'est la consigne finale qui décide de ce que
les modèles renvoient (CLAUDE.md, point 4), et son retrait n'apportait rien.
Les trois redondances retirées :

- la liste des infrastructures partait **deux fois**, au sommet et dans
  `options` — seule reste celle que la consigne cite ;
- elle détaillait chaque infrastructure verrouillée de chaque ville, douze
  « Déblocage manquant » sur douze — restent les constructibles, et une ligne par
  type verrouillé avec son déblocage ;
- l'histoire diplomatique grandissait sans fin, surtout d'offres répétées —
  restent les six derniers faits.

Ce qu'on ne sait pas : pourquoi l'hébergeur refusait. Un texte neutre de même
longueur passait toujours ; ce n'est donc pas la taille seule. Mais l'effet est
net, et la cause probable — un conseil qui grossit avec la partie — est retirée.

**Remesuré, puisque l'invite a changé** (banc apparié, 6 situations) :

| modèle                     | répond | 1er coup | rejets | médiane |
| -------------------------- | -----: | -------: | -----: | ------: |
| `dots-3-note` (Kilo)       |    6/6 |        5 |      0 |   4,9 s |
| `nex-n2.5-mini` (Kilo)     |    6/6 |        5 |      1 |   3,9 s |
| `codestral` (Mistral)      |    6/6 |        4 |      0 |   4,6 s |
| `dots-3-note` (OpenRouter) |    6/6 |        5 |      1 |   1,3 s |

En durée, le principal (`dots-3-note` par Kilo) fait 20/20, 16 valides du premier coup, 2 rejets, médiane 5,3 s : il passe.

Les quatre restent retenus ; `nex-n2.5-mini`, retenu de justesse jusqu'ici, fait
mieux. **Par le produit**, le conseil d'Ambre qui avait échoué dix fois de suite
passe 3 fois sur 3 ; relancé, le direct est passé du tour 132 au tour 201 sans un
échec.

## Ce qui change dans le dépôt

- **Kilo est un fournisseur** (`kilo:` en préfixe). Il sert **sans clé ses
  modèles `:free` et eux seuls** : un modèle payant ne part jamais sans clé, et
  aucun autre fournisseur ne devient anonyme. Testé.
- `AEVUM_COUNCIL_MODEL` choisit le modèle des conseils chez n'importe quel
  fournisseur. `NOUS_MODEL` ne choisit plus rien : il désignait encore `longcat-2.0` sur la machine de développement, et l'observatoire le proposait par défaut malgré la liste.
- `dots-3-note` et `nex-n2.5-mini` rejoignent les modèles à sortie structurée
  native et à raisonnement bridé — mesurés, pas supposés.
- **`codestral` (Mistral) et `dots-3-note` par OpenRouter rejoignent la
  liste**, chacun avec sa clé ; `parseModelRef` accepte le préfixe
  `openrouter:`, qui partait tel quel et faisait refuser l'identifiant.
- `npm run bench:models` reste : le prochain modèle se mesure en une commande,
  apparié, puis en durée.

## Ce que cela ne prouve pas

- Un jour, une adresse IP, une graine pour la campagne. Kilo limite l'accès
  anonyme à 200 requêtes par heure ; une campagne de 40 tours en consomme 40.
- `dots-3-note` est un modèle **« preview »** : il peut changer ou disparaître.
  `nex-n2.5-mini`, sur la même passerelle, est le second choix mesuré.
- La **qualité de gouvernement** n'est pas mesurée — seulement la disponibilité
  et la légalité des ordres. Un modèle qui joue proprement peut jouer mal.
- Les requêtes partent chez Kilo et chez l'éditeur du modèle. Elles ne portent
  que l'état du jeu, jamais une clé.
