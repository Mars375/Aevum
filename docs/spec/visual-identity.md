# Identité visuelle et vue 3D

Statut : implémenté · Date : 2026-08-19 · Tâche kanban : `t_dc654ba9`

## La contrainte de départ

La carte est explicite sur deux points : **ne pas copier les assets ni
l'identité de Project Napoleon**, et **maintenir un mode 2D accessible et
performant**. Tout ce qui suit en découle.

## Ce qui distingue notre rendu de celui de Napoléon

Napoléon fait une bataille de masse : des soldats individuels par centaines, en
formations, avec évitement de foule continu et animation par sprites. C'est du
spectacle, et c'est très bien fait.

Nous faisons l'inverse, et c'est un choix, pas une limitation :

| | Project Napoleon | Ici |
| --- | --- | --- |
| Unité représentée | Le soldat | **L'escouade** |
| Échelle | Des centaines | 8 à 16 |
| Rendu | Sprites animés, foule RVO | **Géométrie procédurale** |
| Ce qu'on regarde | La bataille | **La décision** |

Aucun asset n'est importé. Pas de modèle, pas de sprite, pas de texture. Tout
est généré : des boîtes, des cylindres, des cônes, un damier. Le projet ne
dépend d'aucun fichier qu'il ne produit pas lui-même.

## La 3D parle la même langue que la 2D

C'est la décision centrale. Le rendu 3D ne réinvente rien : il **soulève** le
langage visuel de la grille.

| Sens | En 2D | En 3D |
| --- | --- | --- |
| Faction | Couleur + initiale | Même couleur, en émissif |
| Archétype | Forme du contour | **Même distinction, en volume** : cube mêlée, cylindre distance, cône éclaireur, gros cube lourde |
| PV | Barre sous l'escouade | Barre flottante |
| Alliance | Liseré pointillé | Anneau au sol |

Un lecteur qui a appris la grille sait lire la vue 3D sans réapprendre. Et
l'archétype reste porté par la **forme**, jamais par la couleur seule — la même
règle d'accessibilité qu'en 2D, pour la même raison : les quatre couleurs de
faction ont des luminances quasi identiques.

## La 2D reste le défaut, et reste complète

Pas « en attendant la 3D ». La grille 2D affiche exactement les mêmes
informations, se lit sans WebGL, et se lit sur un téléphone.

Trois conséquences concrètes :

- **Three.js est chargé à la demande.** Le bundle 2D pèse 48 Ko compressés ; la
  3D en ajoute 121, et un lecteur qui n'ouvre jamais la vue 3D ne les télécharge
  jamais.
- **Sans WebGL, message clair et pas d'écran noir.** La vue 3D annonce que la 2D
  est complète et affiche les mêmes informations. C'est une dégradation, pas une
  panne.
- **La rotation est aussi au clavier.** Une vue qu'on ne peut atteindre qu'en
  glissant est une vue que certains lecteurs ne peuvent pas atteindre. Un seul
  axe de rotation, volontairement : un trackball complet invite à se perdre.

## Mouvement

Les escouades sont interpolées d'un tour à l'autre plutôt que téléportées —
c'est ce qui rend un déplacement lisible. `prefers-reduced-motion` est respecté :
qui demande moins de mouvement reçoit la destination, pas le trajet.

## Audio — synthétisé, aucun fichier

La carte demande de l'audio. Livrer des fichiers supposerait des assets que je
ne peux pas produire, et en emprunter est exactement ce que la carte interdit.

Tout est donc **synthétisé avec Web Audio** : une bouffée de bruit filtrée pour
un coup porté, un clic pour un déplacement, une note descendante pour une
destruction, un accord bref pour une alliance. Quelques centaines d'octets de
code, aucune licence, aucun fichier.

Trois règles :

- **Coupé par défaut.** Un son qui se déclenche seul est un défaut hostile, et
  les navigateurs le bloquent de toute façon.
- **Volume bas.** Ça se joue sous la lecture, pas par-dessus.
- **Trois occurrences maximum par voix et par tour.** Onze coups portés doivent
  s'entendre comme une salve, pas comme onze bruits qui se disputent.

Le son suit le tour affiché et ne se déclenche qu'en avançant : revenir en
arrière est silencieux.

## Ce qui n'a pas été fait

**Pas de terrain, pas de relief, pas d'effets de particules.** Le ruleset v1 et
v2 n'ont ni obstacle ni élévation ; représenter un terrain que le moteur ignore
serait un mensonge visuel. Ça viendra si les règles le demandent, pas avant.

**Pas de Blender.** Avec des escouades et non des soldats, la géométrie
procédurale suffit et garde le projet sans dépendance d'assets. Blender ne se
justifierait que pour des modèles de personnages détaillés, hors périmètre.
