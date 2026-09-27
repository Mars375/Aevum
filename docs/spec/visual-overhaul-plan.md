# Le chantier visuel — plan

Demandé le 27 septembre 2026, une fois le moteur arrivé à un point où il se
passe quelque chose (les civilisations s'étendent, les frontières se touchent).
But : que l'observatoire se **regarde**, pas seulement qu'il se lise. L'essentiel
tient en un mot : animations.

## Où on en est

La vue 3D (`apps/player/src/three/`, 4 000 lignes) montre déjà beaucoup, mais
presque tout y est **immobile** :

| ce qui bouge                           | ce qui ne bouge pas                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| l'eau (shader), les particules météo   | les unités : elles **glissent** d'une case à l'autre (`marches`, 950 ms), sans un pas |
| les arcs de relations, les « moments » | les villes naissent d'un coup, les chantiers n'avancent pas                           |
| la caméra qui vole vers une cible      | les combats n'ont aucune image : une case change de couleur                           |

Les unités sont des `InstancedMesh` : une géométrie partagée, des matrices par
instance. C'est ce qui rend le glissement bon marché — et ce qui interdit les
animations squelettiques, qui demandent un maillage par unité.

La chaîne Blender existe : `scripts/blender/generate-world.py` construit les
modèles actuels (`public/models/world/*.glb`) par script, sans fichier externe.
Le chantier la prolonge ; il ne la remplace pas.

## Le principe qui commande le reste

**Un squelette, des accessoires par âge.** 6 âges × 6 rôles donneraient 36
personnages à modéliser et à animer. À la place : un corps unique, un seul
jeu d'animations, et les accessoires (casque, outil, arme, bouclier) comme
nœuds nommés dans le même fichier — l'application montre ceux de l'âge et du
rôle. Un seul fichier à animer, et un nouveau rôle coûte un accessoire.

Tout modèle est **produit par un script** versionné (`scripts/blender/`), jamais
à la main : il se reconstruit, se relit, et un test le contrôle.

## Les étapes

1. **La chaîne des personnages** — `scripts/blender/units.py` produit
   `public/models/units/body.glb` : squelette, corps, accessoires par âge et
   rôle, matériau `TeamColor` teinté par civilisation. Clips : `idle`, `walk`,
   `work`, `attack`, `die`. Un test charge le fichier avec le `GLTFLoader` de
   Three et vérifie noms des clips, budget de triangles, présence de
   `TeamColor`, pieds au sol — le banc écrit pour choisir entre les deux
   auteurs (ci-dessous) en est le premier jet.
2. **Des unités animées** — les unités quittent `InstancedMesh` pour un
   `SkinnedMesh` cloné par unité avec un `AnimationMixer` (une partie compte
   moins de 60 unités). Elles **marchent** le long du chemin que
   `movement-path.ts` calcule déjà, se tournent vers leur destination,
   travaillent sur leur case, frappent en combat, tombent. `prefers-reduced-motion`
   reste respecté : sans mouvement, la pose finale, directement.
3. **Les événements du tour, joués** — une fondation : le colon plante, la
   ville monte du sol ; un chantier : l'échafaudage monte au rythme de
   `queue.remaining` ; une conquête : les deux camps se heurtent, la bordure
   passe d'une couleur à l'autre ; un nouvel âge : les bâtiments se
   remplacent, la colonne de lumière existe déjà.
4. **Un monde qui respire** — arbres qui ondulent (shader de sommets), fumée
   des ateliers et des usines selon l'âge, ombres de nuages, lumière qui suit
   les saisons que le moteur tire déjà de `(seed, tick)`.
5. **La caméra de spectateur** — un mode « cinéma » qui suit le dirigeant dont
   c'est le tour et se pose sur les événements du tour, arrêtable à tout moment.

Chaque étape se livre seule, se regarde dans le labo (`lab.html?scene=…`), et
passe par la mesure avant d'être dite finie.

## Budget, mesuré avant d'affirmer

- **60 images par seconde** sur un processeur graphique intégré, partie de
  1 200 actions ouverte : à mesurer au début de l'étape 2, puis à chaque étape.
- **Poids** : la vue 3D se charge à la demande ; ses modèles aussi. Un
  personnage fait 90 Ko (premier essai, 530 triangles) — l'ordre de grandeur
  à tenir.
- **Rien de décoratif ne touche au moteur** : l'animation lit le journal, elle
  ne l'écrit jamais. Le rejeu reste la seule vérité (W4).

## Qui modélise

Essai à égalité : même consigne (un lancier de l'âge du bronze, squelette,
trois clips, aperçu), l'un par Astra (Codex, `gpt-6-astra`), l'autre par
Claude, chacun dans son dossier, jugés sur le fichier chargé dans Three et sur
l'aperçu. Le résultat décide qui écrit `units.py` ; il est consigné ci-dessous.

**Résultat du 27 septembre.** Astra n'a pas pu jouer : Codex passe par un relais
local (`127.0.0.1:8787`, OpenCode Go) qui ne tournait pas, et même une requête
d'un mot restait sans réponse. L'essai reste à refaire quand le relais est
lancé — la consigne est prête (`scripts/blender/prototypes/BRIEF.md`).

Côté Claude : un script Blender de 300 lignes
(`scripts/blender/prototypes/spearman.py`), lancé sans interface en 10 s,
donne un lancier de **530 triangles, 90 Ko**, squelette réel, clips `idle`
(2 s), `walk` (1 s), `attack` (0,8 s), matériau `TeamColor`, pieds à y = 0 —
vérifié en le chargeant avec le `GLTFLoader` de Three, pas seulement dans
Blender. Deux passes : la première rendait le bronze trop sombre et le
bouclier cachait le corps. Aperçu : `visual-overhaul-spearman.png`.
