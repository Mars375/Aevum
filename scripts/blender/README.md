# Aevum — modèles de l’atlas

Quatorze modèles originaux générés avec Blender : deux arbres, rochers, hameau,
bourg, citadelle, ferme, mine, ruines, soldat, paysan, bûcheron, mineur et marchand
avec chariot. Le fichier `aevum-world-kit.blend`
contient le kit éditable ; les GLB utilisés par le lecteur se trouvent dans
`apps/player/public/models/world/`.

Pour régénérer depuis la racine du dépôt, avec PowerShell :

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --python-exit-code 1 --python scripts/blender/generate-world.py
```

Adapter le chemin si Blender est installé ailleurs. Le script remplace les
exports et le fichier Blender du kit. Il ne nécessite aucun module Python tiers.
Les couleurs saisies en sRGB sont converties en linéaire pour les matériaux.

Les bâtiments sont une représentation stylisée des données existantes : leur
présence ne crée aucune construction ni nouvelle règle de simulation. La
projection déterministe est dans `apps/player/src/three/world-projection.ts`.
Les capitales évoluent selon la population et les progrès ; les ruines utilisent
uniquement l’historique connu jusqu’à l’année affichée.

Les unités sont des figurines représentatives, sans trajectoires tactiques :
jusqu’à six soldats par civilisation (un pour dix soldats, arrondi supérieur),
et deux figurines par métier, selon la population et les poids de doctrine
normalisés. Chaque lieu accueille au plus quatre figurines, dont deux soldats.
La densité peut donc réduire ces plafonds. Aucun personnage sur les rivières,
les terres libres ou les terres d’une civilisation éteinte. Les métiers
privilégient les terrains adaptés. Le matériau `Faction cloth` est recoloré
dans Three.js, sans dupliquer les géométries.

Le rendu Three.js charge les modèles à la demande, utilise des instances et ne
redessine que lorsqu’il change. La vue 2D reste disponible en cas d’échec WebGL.
