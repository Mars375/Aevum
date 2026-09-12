# Carte des civilisations en 3D

Direction validée dans la conversation : maquette miniature stylisée, modèles
Blender originaux, carte Three.js intégrée à la chronique. Priorité au visuel ;
les corrections opérationnelles de l'audit restent une étape suivante.

La carte est le centre du lecteur. Palette de paysage : pins #315b40,
prairies #829466, calcaire #b6af91, eau #438e98, fond #101c26 et laiton #d5a66f.
Le relief et les constructions sont une représentation, pas de nouvelles règles.
Les cases, propriétaires et capitales viennent du moteur. Population et progrès
pilotent le niveau visuel des cités ; les anciennes capitales abandonnées peuvent
porter des ruines uniquement quand l'historique établit leur existence.

Architecture : projection pure des données, kit GLB généré par Python/Blender,
scène Three.js indépendante, composant Vue gérant chargement et repli 2D,
WorldStage pour la légende, la sélection et la chronologie. Chargement différé,
modèles instanciés, densité de pixels bornée, rendu à la demande et destruction
des ressources GPU au démontage. Aucun appel IA pour afficher un monde.

Interactions : orbite tactile/souris, zoom, recentrage, sélection d'un territoire,
choix des civilisations par boutons accessibles, lecture/pause et curseur annuel.
La carte 2D reste accessible et prend le relais si WebGL ou les modèles échouent.
Les informations demeurent disponibles au clavier en dehors du canvas.

Validation : export Blender effectif ; tests de projection aux changements
d'année, capitales et ruines ; build et contrôle TS ; navigateur desktop/mobile,
sélection, chronologie, repli et démontage. Les échecs Windows déjà identifiés
dans l'audit sont distingués des régressions de ce travail.
