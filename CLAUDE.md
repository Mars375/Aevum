# ai-battle-simulator — ce qu'une session doit savoir avant de toucher au code

Ce fichier existe pour une raison précise : **éviter qu'une session neuve
redécouvre, et surtout refasse, ce qui a déjà été mesuré.** Ce qui coûte cher à
retrouver n'est pas où se trouve une fonction — un `grep` le dit en une
seconde — c'est *pourquoi c'est ainsi* et *ce qu'on a déjà essayé qui ne
marchait pas.*

Garder ce fichier court est le but. S'il grossit, il ne sera plus lu.

## Ce que c'est

Des modèles de langage gouvernent quatre civilisations dans un monde qui ne
s'arrête pas. Un moteur déterministe fait tout le reste. Trois jeux de règles
coexistent : **v1** et **v2** sont des batailles tactiques, gelées ; **w4** est
le monde continu, et c'est là que le travail se fait.

Le partage qui commande tout : **le modèle décide, le moteur tranche.** Un ordre
illégal est rejeté et enregistré, jamais réécrit en silence. C'est ce qui rend
un rejeu auditable.

Le second, propre au monde : **le moteur tourne en continu et gratuitement ; un
modèle n'est consulté qu'aux points de décision.** Un appel par civilisation et
par tour épuiserait un quota quotidien en minutes.

## Les invariants qu'on ne casse pas

Les six du monde sont dans `docs/spec/world-w4.md`. Les deux qui se cassent le
plus facilement :

- **W4 — rejouer le journal reproduit l'état.** Il est tombé une fois, en
  silence : une décision différée était appliquée à l'année où la question avait
  été *posée* et non répondue. Un monde se déclarait alors éteint pendant qu'un
  rejeu le montrait vivant.
- **Rien de non déterministe dans `engine` et `world`.** Pas d'horloge, pas de
  `Math.random`. Les saisons, les bandits et les catastrophes viennent d'un hash
  pur de `(seed, tick)`. `packages/contracts/test/boundaries.test.ts` le vérifie,
  ainsi que les frontières entre paquets.

## Ce qui a déjà été réfuté — ne pas refaire

1. **Un horizon long n'est pas une meilleure mesure.** Le bruit du plateau passe
   de 0,21 à 60 ans à 0,56 à 320. Mais un horizon court coupe la moitié
   intéressante : le plateau ne se remplit qu'à **l'an 148**, et guerres,
   capitales prises et extinctions arrivent après. Les deux effets sont réels et
   se contredisent — voir `docs/reports/board-noise.md`.
2. **Comparer des moyennes entre courses jette l'appariement.** Les quatre
   modèles partagent le même monde dans une course ; les comparer là supprime la
   variance du plateau. `npm run rank-eras` le fait.
3. **« Servi » ne veut pas dire « a répondu ».** Un modèle dont la chaîne de
   repli répond à sa place n'a pas gouverné. Toute mesure doit afficher la part
   servie par le modèle lui-même, et un modèle sous 70 % n'est pas classable.
4. **La consigne finale d'un prompt décide de ce que les modèles renvoient.**
   Trois champs sont revenus vides pour avoir manqué à cette liste, quelle que
   soit la qualité des explications au-dessus.
5. **Un champ absent, `null`, ou dans une autre forme, n'est pas une erreur.**
   On lit ce que les modèles envoient (`shares`, `employment`, `vow` imbriqué,
   `reason` pour `reasoning`) plutôt que de jeter une bonne décision pour une
   question de forme.
6. **Réduire `max_tokens` pour gagner du débit tronquerait les modèles qui
   raisonnent.** Mesuré : 170 jetons de réponse pour trois modèles, 950 pour
   `gpt-oss`.

## Avant de dépenser du quota

```
npm run preflight        # 4 appels : chaque modele repond-il POUR LUI-MEME ?
npm run world:probe      # combien d'appels un monde demanderait. Zero depense
npm run board-fairness   # le bruit du plateau, donc ce qu'une mesure peut prouver
```

Le palier gratuit est un **budget d'appels**, pas une limite de débit — mesuré
deux fois. Tout script long reprend là où il s'est arrêté ; s'arrêter est le
mode normal.

## Où regarder

| | |
| --- | --- |
| les règles et les six invariants | `docs/spec/world-w4.md` |
| tout ce qui a été mesuré | `docs/reports/` |
| les conventions et le défaut qui a enseigné chacune | skill `project-conventions` |
| l'état d'avancement | carte kanban `t_baa4de0e` |

## Comment travailler ici

- **Mesurer avant d'affirmer.** Presque toute affirmation de ce dépôt porte le
  chiffre qui la soutient, et plusieurs mesures ont réfuté la thèse qu'elles
  devaient servir. Quand c'est le cas, on l'écrit.
- **Un commentaire dit pourquoi, et de préférence quel défaut l'a appris.**
- **Le français pour les documents et les messages de commit, l'anglais pour le
  code et les prompts.**
- **Ne jamais faire passer une clé dans un commit, un prompt ou une URL.**
  `.env` est en 600 et ignoré ; la CI et les tests de frontière le vérifient.
