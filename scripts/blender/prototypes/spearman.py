"""Bronze-age spearman for the Aevum observatory.

Run: blender --background --factory-startup --python soldier.py
Outputs soldier.glb (three clips: idle, walk, attack) and preview.png.

Rigid skinning: every primitive is weighted fully to one bone, which keeps the
faceted-miniature look (no stretched joints) while still being a real skinned
mesh the app can drive with an AnimationMixer.
"""
import bpy
import math
import os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 24

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS


def linear(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, srgb, rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*linear(srgb), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = (*linear(srgb), 1)
    return m


MAT = {
    "skin": material("Skin", (0.78, 0.56, 0.40)),
    "team": material("TeamColor", (0.80, 0.80, 0.80)),  # tinted by the app
    "bronze": material("Bronze", (0.86, 0.62, 0.30), 0.55, 0.25),
    "leather": material("Leather", (0.36, 0.23, 0.13)),
    "wood": material("Walnut", (0.28, 0.17, 0.10)),
    "cloth": material("Linen", (0.86, 0.80, 0.64)),
}

# ---------------------------------------------------------------- armature
# Z-up, character faces -Y (Blender front), which glTF maps to +Z.
bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
rig = bpy.context.object
rig.name = "Spearman"
arm = rig.data
arm.name = "SpearmanRig"
eb = arm.edit_bones
root = eb[0]
root.name = "root"
root.head, root.tail = (0, 0, 0), (0, 0.06, 0)


def bone(name, head, tail, parent):
    b = eb.new(name)
    b.head, b.tail = head, tail
    b.parent = eb[parent]
    return b


bone("hips", (0, 0, 0.130), (0, 0, 0.160), "root")
bone("spine", (0, 0, 0.160), (0, 0, 0.245), "hips")
bone("head", (0, 0, 0.245), (0, 0, 0.330), "spine")
bone("leg.L", (0.022, 0, 0.130), (0.022, 0, 0.012), "hips")
bone("leg.R", (-0.022, 0, 0.130), (-0.022, 0, 0.012), "hips")
bone("arm.L", (0.050, 0, 0.232), (0.058, 0, 0.150), "spine")
bone("arm.R", (-0.050, 0, 0.232), (-0.058, 0, 0.150), "spine")
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- body parts
parts = []


def part(kind, bone_name, mat, location, scale=(1, 1, 1), rotation=(0, 0, 0), **kw):
    op = {
        "cube": bpy.ops.mesh.primitive_cube_add,
        "cyl": bpy.ops.mesh.primitive_cylinder_add,
        "cone": bpy.ops.mesh.primitive_cone_add,
        "ico": bpy.ops.mesh.primitive_ico_sphere_add,
        "uv": bpy.ops.mesh.primitive_uv_sphere_add,
    }[kind]
    op(location=location, rotation=rotation, **kw)
    o = bpy.context.object
    o.scale = scale
    o.data.materials.append(mat)
    vg = o.vertex_groups.new(name=bone_name)
    vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
    parts.append(o)
    return o


# legs and sandals
for side, x in (("L", 0.022), ("R", -0.022)):
    part("cyl", f"leg.{side}", MAT["skin"], (x, 0, 0.075), (0.013, 0.013, 0.055), vertices=6)
    part("cube", f"leg.{side}", MAT["leather"], (x, -0.006, 0.008), (0.014, 0.022, 0.008))
    part("cyl", f"leg.{side}", MAT["bronze"], (x, -0.004, 0.060), (0.015, 0.015, 0.025), vertices=6)  # greave
# kilt and tunic (team colour)
part("cone", "hips", MAT["team"], (0, 0, 0.140), (1, 1, 1), vertices=8, radius1=0.050, radius2=0.036, depth=0.050)
part("cyl", "spine", MAT["team"], (0, 0, 0.195), (0.040, 0.030, 0.045), vertices=8)
part("cube", "spine", MAT["bronze"], (0, -0.029, 0.205), (0.030, 0.006, 0.030))  # breastplate
part("cube", "hips", MAT["leather"], (0, 0, 0.166), (0.042, 0.032, 0.006))  # belt
# head, helmet, crest
part("ico", "head", MAT["skin"], (0, 0, 0.270), (0.024, 0.024, 0.027), subdivisions=1)
part("uv", "head", MAT["bronze"], (0, 0.002, 0.279), (0.027, 0.028, 0.022), segments=8, ring_count=5)
part("cube", "head", MAT["team"], (0, 0.004, 0.308), (0.005, 0.030, 0.014))  # crest
part("cube", "head", MAT["bronze"], (0, -0.022, 0.268), (0.004, 0.003, 0.012))  # nose guard
# arms
for side, x in (("L", 0.052), ("R", -0.052)):
    part("cyl", f"arm.{side}", MAT["skin"], (x * 1.08, 0, 0.192), (0.010, 0.010, 0.042), vertices=6)
    part("ico", f"arm.{side}", MAT["skin"], (x * 1.12, 0, 0.150), (0.011, 0.011, 0.011), subdivisions=1)
    part("uv", f"arm.{side}", MAT["team"], (x, 0, 0.228), (0.016, 0.016, 0.013), segments=6, ring_count=4)
# round shield on the left arm, facing forward-out
part("cyl", "arm.L", MAT["team"], (0.074, -0.010, 0.178), (0.040, 0.040, 0.006), (math.radians(90), 0, math.radians(20)), vertices=10)
part("cyl", "arm.L", MAT["bronze"], (0.077, -0.017, 0.178), (0.012, 0.012, 0.005), (math.radians(90), 0, math.radians(20)), vertices=8)
# spear in the right hand: shaft and bronze head
part("cyl", "arm.R", MAT["wood"], (-0.060, -0.004, 0.170), (0.004, 0.004, 0.160), vertices=5)
part("cone", "arm.R", MAT["bronze"], (-0.060, -0.004, 0.345), (1, 1, 1), vertices=4, radius1=0.009, radius2=0, depth=0.034)

bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.object.join()
body = bpy.context.object
body.name = "SpearmanBody"
for poly in body.data.polygons:
    poly.use_smooth = False
body.parent = rig
mod = body.modifiers.new("Armature", "ARMATURE")
mod.object = rig

tris = sum(len(p.vertices) - 2 for p in body.data.polygons)

# ---------------------------------------------------------------- animation
pb = rig.pose.bones
for b in pb:
    b.rotation_mode = "XYZ"


def key(action_name, frames):
    """frames: {frame: {bone: (rx, ry, rz) degrees | ('loc', (x, y, z))}}"""
    rig.animation_data_create()
    action = bpy.data.actions.new(action_name)
    rig.animation_data.action = action
    for b in pb:
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
    for frame in sorted(frames):
        for b in pb:
            b.rotation_euler = (0, 0, 0)
            b.location = (0, 0, 0)
        for name, value in frames[frame].items():
            if value[0] == "loc":
                pb[name].location = value[1]
            else:
                pb[name].rotation_euler = tuple(math.radians(v) for v in value)
        for b in pb:
            b.keyframe_insert("rotation_euler", frame=frame)
            b.keyframe_insert("location", frame=frame)
    # Smooth loops: Bezier with auto-clamped handles, first key == last key.
    track = rig.animation_data.nla_tracks.new()
    track.name = action_name
    strip = track.strips.new(action_name, int(min(frames)), action)
    strip.name = action_name
    rig.animation_data.action = None
    return action


# idle: 2 s, breathing and a slow weight shift
key("idle", {
    1: {"spine": (0, 0, 0), "root": ("loc", (0, 0, 0))},
    13: {"spine": (-2, 0, 1.5), "arm.L": (0, -2, 0), "arm.R": (0, 2, 0), "root": ("loc", (0, 0.0015, 0))},
    25: {"spine": (0, 0, 0), "head": (0, 0, 4), "root": ("loc", (0, 0, 0))},
    37: {"spine": (-2, 0, -1.5), "arm.L": (0, -2, 0), "arm.R": (0, 2, 0), "root": ("loc", (0, 0.0015, 0))},
    49: {"spine": (0, 0, 0), "root": ("loc", (0, 0, 0))},
})

# walk: 1 s full cycle in place; legs counter-swing, body bobs twice
swing = 28
key("walk", {
    1: {"leg.L": (swing, 0, 0), "leg.R": (-swing, 0, 0), "arm.L": (-8, 0, 0), "arm.R": (10, 0, 0), "hips": (0, 0, 3), "root": ("loc", (0, 0, 0))},
    7: {"leg.L": (0, 0, 0), "leg.R": (0, 0, 0), "root": ("loc", (0, 0.006, 0))},
    13: {"leg.L": (-swing, 0, 0), "leg.R": (swing, 0, 0), "arm.L": (8, 0, 0), "arm.R": (-10, 0, 0), "hips": (0, 0, -3), "root": ("loc", (0, 0, 0))},
    19: {"leg.L": (0, 0, 0), "leg.R": (0, 0, 0), "root": ("loc", (0, 0.006, 0))},
    25: {"leg.L": (swing, 0, 0), "leg.R": (-swing, 0, 0), "arm.L": (-8, 0, 0), "arm.R": (10, 0, 0), "hips": (0, 0, 3), "root": ("loc", (0, 0, 0))},
})

# attack: 0.8 s — wind up, thrust forward, recover
key("attack", {
    1: {},
    6: {"arm.R": (-40, 0, -12), "spine": (6, 0, -12), "leg.L": (-10, 0, 0), "leg.R": (12, 0, 0)},
    10: {"arm.R": (80, 0, 8), "spine": (-12, 0, 14), "leg.L": (-20, 0, 0), "leg.R": (18, 0, 0), "arm.L": (-15, 0, 0), "root": ("loc", (0, 0, -0.012))},
    14: {"arm.R": (60, 0, 5), "spine": (-8, 0, 8), "leg.L": (-12, 0, 0), "leg.R": (10, 0, 0), "root": ("loc", (0, 0, -0.006))},
    20: {},
})

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=os.path.join(HERE, "soldier.glb"),
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_apply=False,
    export_yup=True,
)

# ---------------------------------------------------------------- preview
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
scene.render.resolution_x, scene.render.resolution_y = 400, 400
scene.render.film_transparent = False
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*linear((0.11, 0.18, 0.16)), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.5, depth=0.04, location=(0, 0, -0.02))
tile = bpy.context.object
tile.data.materials.append(material("Grass", (0.36, 0.52, 0.30)))

sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
scene.collection.objects.link(sun)

cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = 0.62
d = 2.0
cam.location = (d * math.sin(math.radians(25)) * 0.7, -d * 0.7, d * 0.7)
direction = -cam.location.normalized() if hasattr(cam.location, "normalized") else None
import mathutils  # noqa: E402
cam.rotation_euler = (mathutils.Vector((0, 0, 0.17)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(cam)
scene.camera = cam

# Tint the team colour like a civilization would (crimson) for the preview only.
MAT["team"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*linear((0.66, 0.16, 0.14)), 1)

shots = [("idle", 13), ("walk", 1), ("attack", 10)]
images = []
for track in rig.animation_data.nla_tracks:
    track.mute = True
for name, frame in shots:
    for track in rig.animation_data.nla_tracks:
        track.mute = track.name != name
    scene.frame_set(frame)
    path = os.path.join(HERE, f"_shot_{name}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    px = np.array(img.pixels[:]).reshape(400, 400, 4)
    images.append(px)
    bpy.data.images.remove(img)
    os.remove(path)

out = bpy.data.images.new("preview", 1200, 400, alpha=True)
out.pixels = np.concatenate(images, axis=1).ravel().tolist()
out.filepath_raw = os.path.join(HERE, "preview.png")
out.file_format = "PNG"
out.save()

size = os.path.getsize(os.path.join(HERE, "soldier.glb"))
print(f"RESULT triangles={tris} glb_bytes={size}")
for action in bpy.data.actions:
    start, end = action.frame_range
    print(f"RESULT clip={action.name} seconds={(end - start) / FPS:.2f}")
