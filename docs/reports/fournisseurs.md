# Fournisseurs — la campagne longue a eu lieu, et ce qui la bloquait

La limite que ce dépôt traînait depuis le début — « aucune campagne distante
longue » — tombe : **39 tours distants consécutifs**, servis par le modèle
lui-même, rejeu vérifié. Et la cause du blocage précédent, qui n'était jusqu'ici
qu'une hypothèse, est établie. L'hypothèse était fausse.

## Ce qui est disponible ici

Le code sait appeler cinq fournisseurs : OpenRouter, Groq, NVIDIA et Mistral par
`packages/agents/src/endpoints.ts`, Nous par son propre chemin. Relevé par le
serveur lui-même, qui ne donne que « configuré ou non » : **seul Nous a une clé
sur cette machine**. Aucun `.env`, et parmi les variables d'environnement, seule
`NOUS_API_KEY` sert à l'inférence.

Le code n'accepte que les modèles Nous **gratuits** — la gratuité est vérifiée
dans le catalogue à chaque appel, et l'appel refusé sinon. Le catalogue en
compte **7 sur 409**. Tous essayés avec la plus petite requête possible :

| modèle                            | réponse                                             |
| --------------------------------- | --------------------------------------------------- |
| `meituan/longcat-2.0` (défaut)    | répond                                              |
| `poolside/laguna-s-2.1`           | répond                                              |
| `inclusionai/ling-3.0-flash` (×2) | 200, contenu vide — raisonne au-delà de 50 jetons   |
| `poolside/laguna-xs-2.1`          | 200, contenu vide — idem                            |
| `stepfun/step-3.7-flash`          | **400** « missing tags », même sans aucun paramètre |
| `upstage/solar-pro4`              | **400** « missing tags »                            |

Les deux derniers annoncent pourtant la sortie structurée ; ce compte ne peut
pas s'en servir.

## La campagne longue, avec `laguna-s-2.1`

`NOUS_MODEL=poolside/laguna-s-2.1:free`, `spectator-10`, graine 42, 15 s entre
les tours (`docs/reports/remote-campaign-laguna.json`) :

|                                 |                                                   |
| ------------------------------- | ------------------------------------------------- |
| tours demandés                  | 40                                                |
| **tours joués, servis par lui** | **39**                                            |
| requêtes                        | 45, dont 5 relances — 4 récupérées                |
| arrêt                           | tour 40 : **HTTP 429**, explicite                 |
| latence                         | 8,2 s au mieux, 14,5 s en médiane, 24,9 s au pire |
| **rejeu**                       | **vérifié**                                       |
| ordres rejetés                  | 19, sur 17 tours ; 22 tours sans                  |

L'arrêt n'a rien à voir avec celui d'hier : c'est une **limite de débit
annoncée**, pas un silence — et une minute plus tard, le même modèle répondait.

**Les 19 rejets sont du modèle, pas du contrat.** 18 sont des constructions
refusées, et le même dirigeant redemande le même bâtiment de tour en tour.
Vérifié en rejouant la campagne : **aucune** des 18 ne figurait dans
`options.construction` au moment de l'ordre — chantier déjà occupé, bâtiment
déjà construit ou réserves insuffisantes, toutes choses que la liste excluait
déjà. `laguna` tient la distance, mais lit moins bien ses options que
`longcat`, qui n'avait rejeté aucun ordre sur ses dix tours.

## Pourquoi `longcat` s'arrêtait

Rejoué aujourd'hui, mêmes réglages qu'hier, graine 42 : **deux tours, puis le
troisième conseil dépasse le délai**, relance comprise — exactement comme hier,
quelques minutes après les 39 tours de `laguna`, sur le même compte.
**L'allocation de compte, donnée hier comme meilleure explication, est
réfutée.**

Sur la graine 7, `longcat` passe les troisième et quatrième conseils et bloque
au cinquième. Ce n'est donc pas le rang de l'appel non plus : ce sont
**certaines requêtes**.

Le délai de 45 s est le nôtre. Le conseil bloquant, rejoué avec quatre minutes :

|                  |                         |
| ---------------- | ----------------------- |
| réponse          | HTTP 200 en **132,9 s** |
| jetons en entrée | 9 197                   |
| jetons en sortie | **6 000** — le plafond  |
| fin              | `length`                |
| **contenu**      | **0 caractère**         |

Le modèle dépense tout son budget en raisonnement caché et ne répond jamais. Le
code envoie `reasoning: { effort: "none" }` — le catalogue annonce ce
paramètre. Trois autres réglages essayés sur la même requête,
`max_tokens: 1024`, `enabled: false`, `effort: "low"` : **tous ignorés**, 6 000
jetons et zéro caractère à chaque fois, en deux minutes.

Tout ce qui semblait contradictoire hier s'explique. La reprise « échouait dès
son premier appel » parce qu'elle rejouait le même état, donc la même requête
bloquante. Le même conseil avait « réussi une fois » parce que le raisonnement
est tiré avec une température de 0,5. Et l'une des quatre hypothèses
« écartées » l'était à tort : « le modèle ? non, les quatre dirigeants
partagent le même » ne prouvait rien — **partager un modèle ne l'innocente
pas ; en essayer un autre, si.**

## Les autres fournisseurs

Un conseil mesure **9 197 jetons en entrée**, jusqu'à 6 000 en sortie. Limites
gratuites relevées le 23 septembre 2026 dans leurs documentations — elles
changent, et c'est pourquoi elles sont datées :

| fournisseur | dans le code | gratuit                                                | pour Aevum                                                          |
| ----------- | ------------ | ------------------------------------------------------ | ------------------------------------------------------------------- |
| Mistral     | oui          | ~1 requête/s, 500 000 jetons/min, ~1 milliard/mois     | **largement suffisant** ; il faut une clé                           |
| Cerebras    | non          | 5 requêtes/min, 30 000 jetons/min, 1 million/jour      | ~2 conseils/min, ~70 par jour ; une ligne à ajouter au code         |
| NVIDIA      | oui          | 40 requêtes/min, 1 000 crédits (jusqu'à 5 000)         | une réserve finie, pas un débit                                     |
| OpenRouter  | oui          | 50 requêtes/jour sans achat, 1 000 après 10 $ une fois | une campagne de 40 tours par jour, sans achat                       |
| Groq        | oui          | 8 000 jetons/min pour `gpt-oss-120b`                   | **inutilisable** : un seul conseil dépasse la limite par minute     |
| local       | non          | aucune limite                                          | RTX 5070, 12 Go : un modèle de 8 à 14 milliards ; qualité à mesurer |

Groq était l'hypothèse naturelle — il est dans le code et gratuit. Il ne peut
pas servir un seul conseil : 9 197 jetons d'entrée contre une limite de 8 000
par minute, avant même la sortie que Groq réserve d'avance.

## Ce que cela change

- **La campagne distante longue n'est plus une limite du dépôt.** Elle a été
  jouée, rejouée et vérifiée.
- **Le choix du modèle est un compromis mesuré.** `longcat` gouverne mieux —
  zéro ordre rejeté — mais bloque sur certaines requêtes, sans réglage qui
  l'en empêche. `laguna` tient 39 tours, mais ignore une partie de ses options.
- **Le modèle par défaut reste `longcat`** : en changer est un choix de produit,
  pas une conséquence automatique d'une mesure. `NOUS_MODEL` suffit à basculer.

## Ce que cela ne prouve pas

- Une campagne, une graine, un compte, un jour. La limite de débit de Nous n'est
  pas connue ; elle est tombée à la 45ᵉ requête de celle-ci.
- La qualité de gouvernement n'est pas mesurée — seulement la disponibilité et
  la légalité des ordres.
- Les limites des autres fournisseurs sont celles qu'ils publient, pas des
  mesures faites ici.
