# Blender test task — animated unit for the Aevum observatory

Aevum is a spectator game: AI-governed civilizations on a hex-like tile map, rendered with Three.js (orthographic camera, looking down at ~45°). Its current style: faceted low-poly miniatures, flat matte colors (roughness 0.85), no textures, warm palette (limestone, ivory plaster, oxidised copper, walnut, pine green).

Blender 5.2 is installed at: C:/Program Files/Blender Foundation/Blender 5.2/blender.exe

Deliver, in the current directory only:

1. `soldier.py` — a Blender Python script runnable headless (`blender --background --factory-startup --python soldier.py`) that builds a **bronze-age spearman** from primitives only (no downloaded assets, no textures).
   - Height about 0.35 units; origin at the feet; it stands on a 1-unit map tile.
   - Blender is Z-up; the glTF export must be Y-up (default exporter behaviour).
   - Colors given as sRGB must be converted to linear for Blender inputs.
   - One material must be named exactly `TeamColor` (tunic/shield) so the app can tint it per civilization.
   - A real armature with the mesh skinned to it (not object-level transforms).
   - Three looping actions, exported as three separate glTF animation clips named exactly: `idle` (breathing/weight shift, 2 s), `walk` (one full step cycle, 1 s, in place), `attack` (spear thrust and recovery, 0.8 s).
   - Under 3000 triangles total.
2. `soldier.glb` — produced by running the script.
3. `preview.png` — 1200x400, Eevee, three views side by side (or three renders composited): a mid-pose of idle, walk and attack, seen from the game's camera angle (about 45° down).
4. `REPORT.md` — triangle count, file size, clip names and durations, and anything that did not work.

Quality bar: it must read clearly as a spearman at small size from above, and the animations must look natural when looping (no pop at the loop point). Run the script and verify the outputs yourself before finishing; iterate if the preview looks wrong.
