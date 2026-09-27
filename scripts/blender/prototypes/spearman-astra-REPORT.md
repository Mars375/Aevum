# Aevum bronze-age spearman

Generated and verified with Blender 5.2.1 LTS.
All geometry is built from Blender primitives; no textures, downloads or external packages.

## Asset

- **Triangles:** 2,026 (exported triangle indices; all equipment included; limit < 3,000).
- **GLB size:** 432,244 bytes (422.1 KiB).
- **Rig:** one armature, 18 joints, one joined skinned character mesh.
- All vertices have normalized bone weights. Equipment is skinned to dedicated grip bones.
- Deliberate low-poly rigid-segment skinning at elbows/knees; small joint primitives cover seams.
- Character height approximately 0.352 units; raised spear reaches approximately 0.486.
- Origin at (0, 0, 0), at ground/feet level; no baked tile or display base.
- Fits on a 1-unit tile. Blender Z-up / facing -Y; glTF Y-up / facing +Z.
- `TeamColor` covers the tunic and shield face; other materials remain independent.
- All input palette colors are sRGB, explicitly converted to linear; roughness 0.85.

## Exported clips

| Name | Duration | Animated channels | Endpoint transform error | Reimported mesh seam |
|---|---:|---:|---:|---:|
| `idle` | 2.000 s | 15 | 3.92e-19 | 3.92e-19 units |
| `walk` | 1.000 s | 16 | 0.00e+00 | 0.00e+00 units |
| `attack` | 0.800 s | 16 | 0.00e+00 | 0.00e+00 units |

60 fps sampled bone animation. All clips start at time zero and include identical
first/last poses. Idle and walk use periodic curves; attack includes resting holds
with eased anticipation, forward thrust and recovery. Walk has no root travel.
The spear rotates with the grip from upright guard to forward thrust.

## Verification performed by the script

- Parses actual GLB JSON/binary chunks; checks geometry, skin weights and triangle budget.
- Checks exactly three named clips, exact durations, finite samples and loop endpoints.
- Confirms animation targets are joints (not mesh/armature object transforms).
- Confirms Y-up position bounds, `TeamColor`, and absence of textures.
- Deletes the authoring scene and actions, then imports the exported GLB.
- Checks evaluated skinned vertices for actual movement and matching loop endpoints.
- Checks one-frame velocity agreement at the wrap (finite-difference error < 0.002 units/frame).
- Checks every sampled frame for camera clipping, label clearance and ground penetration
  (< 0.001 units contact tolerance).
- Renders the imported asset in Eevee at 45 degrees down with an orthographic camera.
- Composites three 400x400 renders into the required 1200x400 `preview.png`.
- Checks finite, non-flat, opaque image pixels in each rendered panel.

## Limitations / anything that did not work

- No external Three.js runtime was run. GLB structure and Blender export/import are verified.
- Low-poly segment skinning, not a continuous anatomical skin simulation or cloth simulation.
- Image-view tools rejected image input in this agent session, so visual inspection could not
  be completed. Numeric framing, contact and continuity checks passed; subjective appearance
  and naturalness are not certified. Inspect `preview.png` and the clips in your viewer.
- Blender emitted only forward-looking `use_nodes` deprecation warnings (removal in 6.0).

## Reproduce

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python soldier.py
```
