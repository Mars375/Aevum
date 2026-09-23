# Banc des modèles gratuits — ce qui est stable et propre pour nos tests

La question : parmi tous les modèles gratuits qu'on peut trouver, lequel
gouverne une campagne **sans tomber** (stable) et **sans ordres rejetés**
(propre) ? La réponse, mesurée de bout en bout par le chemin du produit :

> **`kilo:dots-studio/dots-3-note-preview:free`** — 40 tours distants
> consécutifs sur 40, en 40 requêtes sans une relance, **un seul ordre
> rejeté**, 5,2 s de médiane, rejeu vérifié. **Sans clé ni compte.**

`AEVUM_COUNCIL_MODEL=kilo:dots-studio/dots-3-note-preview:free` suffit à s'en
servir pour une campagne. Le modèle par défaut du produit n'a pas été changé.

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

## Ce qui change dans le dépôt

- **Kilo est un fournisseur** (`kilo:` en préfixe). Il sert **sans clé ses
  modèles `:free` et eux seuls** : un modèle payant ne part jamais sans clé, et
  aucun autre fournisseur ne devient anonyme. Testé.
- `AEVUM_COUNCIL_MODEL` choisit le modèle des conseils chez n'importe quel
  fournisseur ; `NOUS_MODEL` reste lu, pour Nous seul.
- `dots-3-note` et `nex-n2.5-mini` rejoignent les modèles à sortie structurée
  native et à raisonnement bridé — mesurés, pas supposés.
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
