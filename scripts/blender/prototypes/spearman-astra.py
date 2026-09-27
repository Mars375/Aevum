"""Aevum bronze-age spearman. Blender 5.2; no external assets or packages.

Run: blender --background --factory-startup --python soldier.py
Outputs are confined to this script's directory. The preview is rendered from
the re-imported GLB, not from the authoring scene. Front is Blender -Y / glTF +Z.
"""
from pathlib import Path
import json
import math
import os
import struct
import sys

# Keep incidental Python caches and Blender temporary renders in the workspace.
sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent
os.environ["TMP"] = os.environ["TEMP"] = str(OUT)

import bpy
import numpy as np
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

FPS = 60
CLIPS = {"idle": 120, "walk": 60, "attack": 48}
V = Vector
parts = []


def linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material(name, hex_color, metallic=0.0):
    rgb = [linear(int(hex_color[i:i + 2], 16) / 255) for i in (0, 2, 4)]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def finish(obj, name, mat, bone=None):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    if bone:
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
        parts.append(obj)
    return obj


def ellipsoid(name, pos, scale, mat, bone, segments=10, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat, bone)


def box(name, pos, scale, mat, bone, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    if bevel:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = obj.modifiers.new("Single facet edge", "BEVEL")
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat, bone)


def rod(name, a, b, radius, mat, bone, vertices=8, radius2=None):
    a, b = V(a), V(b)
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=radius,
        radius2=radius if radius2 is None else radius2,
        depth=(b - a).length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    return finish(obj, name, mat, bone)


def ik_joint(a, b, length1, length2, pole):
    """Analytic two-bone IK, baked to deform bones; no runtime constraints."""
    a, b = V(a), V(b)
    direction = b - a
    distance = direction.length
    assert abs(length1 - length2) < distance < length1 + length2, (
        "Unreachable limb target", distance, length1 + length2)
    direction.normalize()
    along = (length1**2 - length2**2 + distance**2) / (2 * distance)
    side = V(pole) - direction * V(pole).dot(direction)
    side.normalize()
    return a + direction * along + side * math.sqrt(max(0, length1**2 - along**2))


def smoothstep(x):
    x = max(0, min(1, x))
    return x * x * (3 - 2 * x)


def pose_points(clip, t):
    """Periodic gait plus a held-guard / anticipation / thrust / recovery."""
    p = 2 * math.pi * t
    root = V((0, 0, 0))
    hip_z = 0.161
    tilt = 0
    sway = 0
    thrust = 0
    anticipation = 0
    if clip == "idle":
        root.x = 0.0016 * math.sin(p)
        hip_z += 0.0008 * math.sin(p)
        sway = 0.012 * math.sin(p)
    elif clip == "walk":
        hip_z = 0.153 + 0.002 * math.cos(2 * p)
        root.x = 0.0025 * math.cos(p)
        sway = 0.045 * math.cos(p)
        tilt = 0.035
    elif clip == "attack":
        # Zero derivative during the rest holds at both ends.
        anticipation = smoothstep((t - 0.06) / 0.16) * (1 - smoothstep((t - 0.22) / 0.14))
        thrust = smoothstep((t - 0.23) / 0.19) * (1 - smoothstep((t - 0.52) / 0.34))
        root.y = 0.006 * anticipation - 0.022 * thrust
        hip_z -= 0.008 * thrust
        tilt = -0.045 * anticipation + 0.12 * thrust

    pelvis = root + V((0, 0, hip_z))
    # Rotation about X leans the chest toward the forward (-Y) direction.
    torso_rot = Matrix.Rotation(tilt, 3, "X") @ Matrix.Rotation(sway, 3, "Z")
    waist = pelvis + V((0, 0, 0.025))
    chest = waist + torso_rot @ V((0, 0, 0.069))
    result = {
        "root": (V((0, 0, 0)), V((0, 0, 0.04))),
        "pelvis": (pelvis, waist),
        "spine": (waist, chest),
        "head": (chest + torso_rot @ V((0, 0, 0.016)),
                 chest + torso_rot @ V((0, 0, 0.073))),
    }
    for side, sign in (("L", -1), ("R", 1)):
        phase = p + (math.pi if sign < 0 else 0)
        ankle = V((sign * 0.028, 0, 0.019))
        if clip == "walk":
            ankle.y = 0.030 * math.cos(phase)
            ankle.z += 0.016 * max(0, math.sin(phase)) ** 2
        elif clip == "attack":
            ankle.y = (-0.023 if sign < 0 else 0.018) * thrust
        hip = pelvis + V((sign * 0.025, 0, 0))
        knee = ik_joint(hip, ankle, 0.075, 0.075, (0, -1, 0))
        toe_dir = V((0, -0.03, 0))
        if clip == "walk":
            toe_dir = Matrix.Rotation(-0.12 * max(0, math.sin(phase)), 3, "X") @ toe_dir
        result[f"thigh.{side}"] = hip, knee
        result[f"shin.{side}"] = knee, ankle
        result[f"foot.{side}"] = ankle, ankle + toe_dir

        shoulder = chest + torso_rot @ V((sign * 0.048, 0, -0.005))
        hand = root + V((sign * 0.085, -0.043, hip_z + 0.066))
        if clip == "idle":
            hand.z += 0.0012 * math.sin(p)
        elif clip == "walk":
            hand.y += sign * 0.010 * math.cos(p)
            hand.z += 0.002 * math.cos(2 * p)
        elif clip == "attack":
            if sign > 0:
                hand.y += 0.018 * anticipation - 0.078 * thrust
                hand.z += 0.005 * anticipation + 0.008 * thrust
                hand.x -= 0.015 * thrust
            else:
                hand.y -= 0.008 * thrust
                hand.z += 0.006 * thrust
        elbow = ik_joint(shoulder, hand, 0.062, 0.060, (sign * 0.8, 0.7, -0.6))
        result[f"upper_arm.{side}"] = shoulder, elbow
        result[f"forearm.{side}"] = elbow, hand
        result[f"hand.{side}"] = hand, hand + V((0, -0.012, 0))
        if sign > 0:
            angle = 0.25 + 1.29 * thrust - 0.12 * anticipation
            if clip == "walk":
                angle += 0.025 * math.cos(p)
            spear_direction = V((0, -math.sin(angle), math.cos(angle)))
            result["spear"] = hand, hand + spear_direction * 0.10
        else:
            result["shield"] = hand, hand + V((-0.008, -0.04, 0.004 * thrust))
    return result


def create_armature():
    rest = pose_points("idle", 0)
    data = bpy.data.armatures.new("Spearman skeleton")
    rig = bpy.data.objects.new("Spearman", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    parents = {"pelvis": "root", "spine": "pelvis", "head": "spine",
               "spear": "hand.R", "shield": "hand.L"}
    for side in ("L", "R"):
        parents.update({f"thigh.{side}": "pelvis", f"shin.{side}": f"thigh.{side}",
                        f"foot.{side}": f"shin.{side}", f"upper_arm.{side}": "spine",
                        f"forearm.{side}": f"upper_arm.{side}",
                        f"hand.{side}": f"forearm.{side}"})
    # Dictionary creation order is not necessarily hierarchy order.
    for name, (a, b) in rest.items():
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = a, b
    for name, parent in parents.items():
        data.edit_bones[name].parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return rig, rest


def create_model(rig, rest):
    team = material("TeamColor", "426A5B")
    linen = material("Ivory linen", "E5D5AF")
    bronze = material("Warm bronze", "A88045", 0.18)
    patina = material("Oxidised copper", "658D79", 0.08)
    skin = material("Terracotta skin", "C38C65")
    wood = material("Walnut", "65442D")
    leather = material("Leather", "644333")
    dark = material("Hair and eyes", "302C25")

    # Faceted tunic and flared linen-underlaid skirt.
    tunic = rod("Tunic", (0, 0, 0.192), (0, 0, 0.252),
                0.034, team, "spine", 8, 0.049)
    tunic.scale.y = 0.63
    bpy.context.view_layer.objects.active = tunic
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    skirt = rod("Linen hem", (0, 0, 0.145), (0, 0, 0.195),
                0.047, linen, "pelvis", 8, 0.031)
    skirt.scale.y = 0.70
    bpy.context.view_layer.objects.active = skirt
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    overskirt = rod("Tunic skirt", (0, 0, 0.151), (0, 0, 0.197),
                    0.0465, team, "pelvis", 8, 0.033)
    overskirt.scale.y = 0.71
    bpy.context.view_layer.objects.active = overskirt
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    belt = rod("Waist belt", (0, 0, 0.188), (0, 0, 0.201),
               0.035, leather, "pelvis", 8)
    belt.scale.y = 0.70
    bpy.context.view_layer.objects.active = belt
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    box("Belt buckle", (0, -0.026, 0.195), (0.013, 0.005, 0.009), bronze, "pelvis", 0.001)
    # Small chest fastener and cross-body leather harness, not plate armour.
    harness = box("Leather baldric", (0, -0.026, 0.231),
                  (0.011, 0.005, 0.055), leather, "spine")
    harness.rotation_euler.y = -0.48
    ellipsoid("Bronze clasp", (-0.013, -0.029, 0.246),
              (0.008, 0.003, 0.008), bronze, "spine", 8, 4)
    rod("Neck", (0, 0, 0.253), (0, 0, 0.286), 0.014, skin, "head", 8)
    ellipsoid("Head", (0, -0.002, 0.303), (0.029, 0.026, 0.033), skin, "head")
    ellipsoid("Short beard", (0, -0.013, 0.285),
              (0.022, 0.018, 0.014), dark, "head", 8, 4)
    box("Angular nose", (0, -0.030, 0.304), (0.008, 0.012, 0.013), skin, "head", 0.002)
    for x in (-0.010, 0.010):
        box("Eye", (x, -0.026, 0.311), (0.004, 0.002, 0.003), dark, "head")
    # Simple ribbed bronze cap with cheek guards. All are mesh primitives.
    ellipsoid("Bronze helmet", (0, 0.001, 0.326),
              (0.033, 0.029, 0.023), bronze, "head", 12, 6)
    rim = rod("Helmet brow band", (0, 0, 0.316), (0, 0, 0.323),
              0.0335, bronze, "head", 12)
    rim.scale.y = 0.88
    bpy.context.view_layer.objects.active = rim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    box("Helmet central rib", (0, 0, 0.345), (0.006, 0.036, 0.013), bronze, "head", 0.002)
    for sign in (-1, 1):
        cheek = box("Cheek guard", (sign * 0.026, -0.012, 0.301),
                    (0.008, 0.016, 0.030), bronze, "head", 0.002)
        cheek.rotation_euler.y = sign * 0.12
        ellipsoid("Helmet rivet", (sign * 0.023, -0.023, 0.320),
                  (0.0024, 0.0024, 0.0024), patina, "head", 6, 3)
    for side, sign in (("L", -1), ("R", 1)):
        hip, knee = rest[f"thigh.{side}"]
        _, ankle = rest[f"shin.{side}"]
        rod("Leg", hip, knee, 0.016, skin, f"thigh.{side}", 7, 0.0125)
        ellipsoid("Knee", knee, (0.013, 0.013, 0.013), skin, f"shin.{side}", 8, 4)
        rod("Calf", knee, ankle, 0.013, skin, f"shin.{side}", 7, 0.0085)
        rod("Shin binding", ankle + V((0, 0, 0.019)), ankle + V((0, 0, 0.032)),
            0.0115, leather, f"shin.{side}", 7)
        box("Sandal sole", (ankle.x, -0.010, 0.005),
            (0.026, 0.049, 0.010), leather, f"foot.{side}", 0.003)
        box("Foot", (ankle.x, -0.014, 0.013),
            (0.022, 0.039, 0.016), skin, f"foot.{side}", 0.004)
        box("Sandal strap", (ankle.x, -0.023, 0.022),
            (0.024, 0.008, 0.004), leather, f"foot.{side}")
        shoulder, elbow = rest[f"upper_arm.{side}"]
        _, wrist = rest[f"forearm.{side}"]
        sleeve_end = shoulder.lerp(elbow, 0.42)
        rod("Short sleeve", shoulder, sleeve_end, 0.022, team, f"upper_arm.{side}", 8, 0.019)
        rod("Upper arm", shoulder.lerp(elbow, 0.30), elbow, 0.014, skin,
            f"upper_arm.{side}", 8, 0.011)
        ellipsoid("Elbow", elbow, (0.0115, 0.0115, 0.0115), skin, f"forearm.{side}", 8, 4)
        rod("Forearm", elbow, wrist, 0.0125, skin, f"forearm.{side}", 8, 0.008)
        rod("Wrist binding", elbow.lerp(wrist, 0.69), elbow.lerp(wrist, 0.94),
            0.0105, leather, f"forearm.{side}", 8, 0.009)
        ellipsoid("Closed hand", wrist, (0.011, 0.011, 0.013), skin, f"hand.{side}", 8, 4)

    hand, tip = rest["spear"]
    direction = (tip - hand).normalized()
    rod("Walnut spear shaft", hand - direction * 0.175, hand + direction * 0.220,
        0.0032, wood, "spear", 8)
    rod("Bronze butt cap", hand - direction * 0.175, hand - direction * 0.161,
        0.004, bronze, "spear", 8, 0.0035)
    rod("Spear socket", hand + direction * 0.203, hand + direction * 0.225,
        0.0048, bronze, "spear", 8, 0.004)
    # Paired flattened four-sided cones form a broad leaf / diamond spearhead.
    blade_base = hand + direction * 0.218
    blade_wide = hand + direction * 0.233
    blade_tip = hand + direction * 0.267
    for name, a, b, r1, r2 in (("Leaf base", blade_base, blade_wide, 0.0025, 0.013),
                               ("Leaf tip", blade_wide, blade_tip, 0.013, 0)):
        obj = rod(name, a, b, r1, bronze, "spear", 4, r2)
        # Local XY cross-section flattened; sharp faceted midrib remains.
        obj.scale.y = 0.25
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Round shield: distinct team face, bronze rim, center boss. One skinned mesh.
    hand, endpoint = rest["shield"]
    n = (endpoint - hand).normalized()
    center = hand + n * 0.012
    rod("Shield wooden back", center - n * 0.005, center, 0.053, wood, "shield", 12)
    rod("Shield bronze rim", center, center + n * 0.006, 0.056, bronze, "shield", 12)
    rod("Shield team face", center + n * 0.0061, center + n * 0.009,
        0.0495, team, "shield", 12)
    rod("Shield boss", center + n * 0.009, center + n * 0.019,
        0.015, bronze, "shield", 10, 0.007)
    # Four deliberately broad oxide rivets remain legible at miniature scale.
    tangent = n.cross(V((0, 0, 1))).normalized()
    for offset in (tangent * 0.038, -tangent * 0.038, V((0, 0, 0.038)), V((0, 0, -0.038))):
        pos = center + n * 0.010 + offset
        ellipsoid("Shield rivet", pos, (0.003, 0.003, 0.003), patina, "shield", 6, 3)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = "SpearmanMesh"
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mod = mesh.modifiers.new("Skin", "ARMATURE")
    mod.object = rig
    mesh.parent = rig
    mesh.data.calc_loop_triangles()
    assert len(mesh.data.loop_triangles) < 3000
    assert all(abs(sum(g.weight for g in v.groups) - 1) < 1e-6 for v in mesh.data.vertices)
    return mesh


def animate(rig, rest):
    actions = {}
    bones = sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive))
    for clip, end in CLIPS.items():
        action = bpy.data.actions.new(clip)
        action.use_fake_user = True
        rig.animation_data_create()
        rig.animation_data.action = action
        for frame in range(end + 1):
            bpy.context.scene.frame_set(frame)
            targets = pose_points(clip, frame / end)
            for pb in bones:
                a, b = targets[pb.name]
                old_a, old_b = rest[pb.name]
                delta = (old_b - old_a).rotation_difference(b - a)
                rotation = delta.to_matrix() @ rig.data.bones[pb.name].matrix_local.to_3x3()
                pb.matrix = Matrix.Translation(a) @ rotation.to_4x4()
                bpy.context.view_layer.update()
                # Bake only bone transforms, never object motion.
                pb.keyframe_insert("location", frame=frame, group=pb.name)
                pb.keyframe_insert("rotation_quaternion", frame=frame, group=pb.name)
                pb.keyframe_insert("scale", frame=frame, group=pb.name)
        # Explicit linear interpolation agrees with glTF's sampled curves.
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:
                            key.interpolation = "LINEAR"
        actions[clip] = action
    rig.animation_data.action = actions["idle"]
    bpy.context.scene.frame_set(0)
    return actions


def parse_glb(path):
    blob = path.read_bytes()
    magic, version, size = struct.unpack_from("<4sII", blob)
    assert magic == b"glTF" and version == 2 and size == len(blob)
    pos = 12
    doc, binary = None, None
    while pos < len(blob):
        length, kind = struct.unpack_from("<II", blob, pos)
        payload = blob[pos + 8:pos + 8 + length]
        if kind == 0x4E4F534A:
            doc = json.loads(payload)
        elif kind == 0x004E4942:
            binary = payload
        pos += 8 + length
    assert doc and binary
    return doc, binary


def accessor(doc, binary, index):
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    dims = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[acc["type"]]
    dtype = {5121: "u1", 5123: "<u2", 5125: "<u4", 5126: "<f4"}[acc["componentType"]]
    offset = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    item_size = np.dtype(dtype).itemsize
    return np.ndarray((acc["count"], dims), dtype=dtype, buffer=binary, offset=offset,
                      strides=(view.get("byteStride", dims * item_size), item_size)).copy()


def check_glb(path):
    doc, binary = parse_glb(path)
    names = [anim["name"] for anim in doc["animations"]]
    assert sorted(names) == sorted(CLIPS), names
    assert len(doc["skins"]) == 1
    assert not doc.get("images") and not doc.get("textures")
    assert any(mat["name"] == "TeamColor" for mat in doc["materials"])
    primitives = [p for mesh in doc["meshes"] for p in mesh["primitives"]]
    triangles = sum(doc["accessors"][p["indices"]]["count"] // 3 for p in primitives)
    assert triangles < 3000
    for prim in primitives:
        assert prim.get("mode", 4) == 4
        assert "JOINTS_0" in prim["attributes"] and "WEIGHTS_0" in prim["attributes"]
        weights = accessor(doc, binary, prim["attributes"]["WEIGHTS_0"])
        assert np.max(np.abs(weights.sum(axis=1) - 1)) < 1e-5
    joints = set(doc["skins"][0]["joints"])
    results = {}
    for anim in doc["animations"]:
        duration = 0
        max_seam = 0
        changed = 0
        for channel in anim["channels"]:
            assert channel["target"]["node"] in joints, "Object-level animation found"
            sampler = anim["samplers"][channel["sampler"]]
            times = accessor(doc, binary, sampler["input"]).ravel()
            values = accessor(doc, binary, sampler["output"])
            assert np.all(np.isfinite(values)) and np.all(np.diff(times) > 0)
            assert abs(times[0]) < 1e-6
            duration = max(duration, float(times[-1]))
            seam = float(np.max(np.abs(values[0] - values[-1])))
            if channel["target"]["path"] == "rotation":
                seam = min(seam, float(np.max(np.abs(values[0] + values[-1]))))
            max_seam = max(max_seam, seam)
            changed += int(np.max(np.abs(values - values[0])) > 1e-4)
        expected = CLIPS[anim["name"]] / FPS
        assert abs(duration - expected) < 1e-5, (anim["name"], duration)
        assert max_seam < 1e-5, (anim["name"], max_seam)
        assert changed > 5, "Clip is effectively static"
        results[anim["name"]] = {"duration": duration, "seam": max_seam,
                                  "animated_channels": changed}
    positions = np.concatenate([accessor(doc, binary, p["attributes"]["POSITION"])
                                for p in primitives])
    # Default exporter maps Blender Z to glTF Y.
    assert positions[:, 1].max() > 0.45 and positions[:, 1].min() > -0.001
    return triangles, results, len(doc["skins"][0]["joints"])


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def reimport_and_verify():
    clear_scene()
    # Remove source actions so the preview cannot accidentally use them.
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.ops.import_scene.gltf(filepath=str(OUT / "soldier.glb"))
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    actions = {}
    for track in rig.animation_data.nla_tracks:
        for strip in track.strips:
            for clip in CLIPS:
                if strip.action.name == clip or track.name == clip or strip.action.name.endswith("_" + clip):
                    actions[clip] = strip.action
        track.mute = True
    for action in bpy.data.actions:
        if action.name in CLIPS:
            actions[action.name] = action
    assert set(actions) == set(CLIPS), [a.name for a in bpy.data.actions]

    def vertices():
        depsgraph = bpy.context.evaluated_depsgraph_get()
        result = []
        for obj in meshes:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            result.extend(tuple(evaluated.matrix_world @ vert.co) for vert in mesh.vertices)
            evaluated.to_mesh_clear()
        return np.array(result)

    measurements = {}
    for clip, end in CLIPS.items():
        rig.animation_data.action = actions[clip]
        bpy.context.scene.frame_set(0)
        start = vertices()
        bpy.context.scene.frame_set(end)
        finish_vertices = vertices()
        seam = float(np.max(np.linalg.norm(start - finish_vertices, axis=1)))
        assert seam < 1e-5
        bpy.context.scene.frame_set(1)
        after_start = vertices()
        bpy.context.scene.frame_set(end - 1)
        before_end = vertices()
        velocity_seam = float(np.max(np.linalg.norm(
            (after_start - start) - (finish_vertices - before_end), axis=1)))
        # One-frame finite differences contain curvature error even for smooth
        # periodic curves. This guards against a visible jump at the wrap.
        assert velocity_seam < 0.002, (clip, velocity_seam)
        bpy.context.scene.frame_set(round(end * (0.42 if clip == "attack" else 0.25)))
        posed = vertices()
        motion = float(np.max(np.linalg.norm(start - posed, axis=1)))
        assert motion > 0.0005
        measurements[clip] = {"mesh_seam": seam, "max_displacement": motion,
                              "velocity_seam_per_frame": velocity_seam}
    return rig, actions, measurements


def preview(rig, actions):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.63, 0.68, 0.72, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    ground_mat = material("Preview limestone", "E1D8C4")
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.004))
    floor = bpy.context.object
    finish(floor, "Preview ground - not exported", ground_mat)
    for name, pos, power, size in (
            ("Large warm key", (-1.1, -1.5, 2), 95, 1.5),
            ("Soft fill", (1.5, -0.3, 1), 40, 1.3)):
        data = bpy.data.lights.new(name, "AREA")
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = pos
        obj.rotation_euler = (V((0, 0, 0.2)) - obj.location).to_track_quat("-Z", "Y").to_euler()
        data.energy = power
        data.shape = "DISK"
        data.size = size
    data = bpy.data.cameras.new("Game orthographic 45deg")
    camera = bpy.data.objects.new("Game orthographic 45deg", data)
    bpy.context.collection.objects.link(camera)
    target = V((0, -0.014, 0.150))
    camera.location = target + V((0.65, -1, math.sqrt(1 + 0.65**2)))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    data.type = "ORTHO"
    data.ortho_scale = 0.55
    scene.camera = camera

    # Numeric layout QA supplements (but cannot replace) visual review.
    actor_meshes = [obj for obj in scene.objects
                   if obj.type == "MESH" and any(m.type == "ARMATURE" for m in obj.modifiers)]
    framing = {}
    for clip, end in CLIPS.items():
        rig.animation_data.action = actions[clip]
        bounds = []
        lowest_z = 1
        for frame in range(end + 1):
            scene.frame_set(frame)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            for obj in actor_meshes:
                evaluated = obj.evaluated_get(depsgraph)
                mesh = evaluated.to_mesh()
                for vertex in mesh.vertices:
                    pos = evaluated.matrix_world @ vertex.co
                    lowest_z = min(lowest_z, pos.z)
                    uv = world_to_camera_view(scene, camera, pos)
                    bounds.append((uv.x, uv.y))
                evaluated.to_mesh_clear()
        bounds = np.array(bounds)
        low, high = bounds.min(axis=0), bounds.max(axis=0)
        assert low[0] > 0.055 and low[1] > 0.12 and np.all(high < 0.91), (clip, low, high)
        assert lowest_z > -0.001, (clip, "ground penetration", lowest_z)
        framing[clip] = {"min_uv": low.tolist(), "max_uv": high.tolist(), "min_z": lowest_z}

    ink = material("Preview text", "504B40")
    shader = ink.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Emission Color"].default_value = ink.diffuse_color
    shader.inputs["Emission Strength"].default_value = 1
    shader.inputs["Base Color"].default_value = (0, 0, 0, 1)
    text_objects = []
    def label(text, x, y, size):
        curve = bpy.data.curves.new(text, "FONT")
        curve.body = text
        curve.align_x = "CENTER"
        curve.size = size
        curve.space_character = 1.2
        obj = bpy.data.objects.new(text, curve)
        bpy.context.collection.objects.link(obj)
        obj.parent = camera
        obj.location = (x, y, -0.8)
        obj.rotation_euler = (0, 0, 0)
        curve.materials.append(ink)
        text_objects.append(obj)
        return curve
    label("AEVUM / BRONZE AGE", 0, 0.243, 0.012)
    caption = label("", 0, -0.236, 0.019)
    subcaption = label("", 0, -0.258, 0.010)
    panels = []
    for clip, fraction in (("idle", 0.25), ("walk", 0.25), ("attack", 0.42)):
        rig.animation_data.action = actions[clip]
        frame = round(CLIPS[clip] * fraction)
        scene.frame_set(frame)
        caption.body = clip.upper()
        subcaption.body = f"{CLIPS[clip] / FPS:.1f} s LOOP  /  {frame / FPS:.2f} s POSE"
        path = OUT / f"_preview_{clip}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        image = bpy.data.images.load(str(path), check_existing=False)
        pixels = np.empty(400 * 400 * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        panels.append(pixels.reshape((400, 400, 4)))
        bpy.data.images.remove(image)
        path.unlink()
    combined = np.concatenate(panels, axis=1)
    image = bpy.data.images.new("Aevum animation comparison", width=1200, height=400, alpha=True)
    image.pixels.foreach_set(combined.ravel())
    image.filepath_raw = str(OUT / "preview.png")
    image.file_format = "PNG"
    image.save()
    assert tuple(image.size) == (1200, 400)
    for panel in panels:
        assert np.all(np.isfinite(panel))
        assert np.std(panel[:, :, :3]) > 0.03, "Empty/flat render"
        assert np.min(panel[:, :, 3]) > 0.99
    return framing


def main():
    clear_scene()
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.render.fps_base = 1
    scene.frame_start = 0
    scene.frame_end = max(CLIPS.values())
    rig, rest = create_armature()
    mesh = create_model(rig, rest)
    animate(rig, rest)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = OUT / "soldier.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", use_selection=True,
        export_yup=True, export_animations=True, export_animation_mode="ACTIONS",
        export_force_sampling=True, export_frame_range=False,
        export_optimize_animation_size=False, export_skins=True,
        export_materials="EXPORT", export_cameras=False, export_lights=False)
    triangles, clips, joints = check_glb(path)
    rig, actions, measurements = reimport_and_verify()
    framing = preview(rig, actions)
    lines = [
        "# Aevum bronze-age spearman", "",
        f"Generated and verified with Blender {bpy.app.version_string}.",
        "All geometry is built from Blender primitives; no textures, downloads or external packages.",
        "", "## Asset", "",
        f"- **Triangles:** {triangles:,} (exported triangle indices; all equipment included; limit < 3,000).",
        f"- **GLB size:** {path.stat().st_size:,} bytes ({path.stat().st_size / 1024:.1f} KiB).",
        f"- **Rig:** one armature, {joints} joints, one joined skinned character mesh.",
        "- All vertices have normalized bone weights. Equipment is skinned to dedicated grip bones.",
        "- Deliberate low-poly rigid-segment skinning at elbows/knees; small joint primitives cover seams.",
        "- Character height approximately 0.352 units; raised spear reaches approximately 0.486.",
        "- Origin at (0, 0, 0), at ground/feet level; no baked tile or display base.",
        "- Fits on a 1-unit tile. Blender Z-up / facing -Y; glTF Y-up / facing +Z.",
        "- `TeamColor` covers the tunic and shield face; other materials remain independent.",
        "- All input palette colors are sRGB, explicitly converted to linear; roughness 0.85.",
        "", "## Exported clips", "",
        "| Name | Duration | Animated channels | Endpoint transform error | Reimported mesh seam |",
        "|---|---:|---:|---:|---:|",
    ]
    for clip in CLIPS:
        c, m = clips[clip], measurements[clip]
        lines.append(f"| `{clip}` | {c['duration']:.3f} s | {c['animated_channels']} | "
                     f"{c['seam']:.2e} | {m['mesh_seam']:.2e} units |")
    lines.extend([
        "", "60 fps sampled bone animation. All clips start at time zero and include identical",
        "first/last poses. Idle and walk use periodic curves; attack includes resting holds",
        "with eased anticipation, forward thrust and recovery. Walk has no root travel.",
        "The spear rotates with the grip from upright guard to forward thrust.",
        "", "## Verification performed by the script", "",
        "- Parses actual GLB JSON/binary chunks; checks geometry, skin weights and triangle budget.",
        "- Checks exactly three named clips, exact durations, finite samples and loop endpoints.",
        "- Confirms animation targets are joints (not mesh/armature object transforms).",
        "- Confirms Y-up position bounds, `TeamColor`, and absence of textures.",
        "- Deletes the authoring scene and actions, then imports the exported GLB.",
        "- Checks evaluated skinned vertices for actual movement and matching loop endpoints.",
        "- Checks one-frame velocity agreement at the wrap (finite-difference error < 0.002 units/frame).",
        "- Checks every sampled frame for camera clipping, label clearance and ground penetration",
        "  (< 0.001 units contact tolerance).",
        "- Renders the imported asset in Eevee at 45 degrees down with an orthographic camera.",
        "- Composites three 400x400 renders into the required 1200x400 `preview.png`.",
        "- Checks finite, non-flat, opaque image pixels in each rendered panel.",
        "", "## Limitations / anything that did not work", "",
        "- No external Three.js runtime was run. GLB structure and Blender export/import are verified.",
        "- Low-poly segment skinning, not a continuous anatomical skin simulation or cloth simulation.",
        "- Image-view tools rejected image input in this agent session, so visual inspection could not",
        "  be completed. Numeric framing, contact and continuity checks passed; subjective appearance",
        "  and naturalness are not certified. Inspect `preview.png` and the clips in your viewer.",
        "- Blender emitted only forward-looking `use_nodes` deprecation warnings (removal in 6.0).",
        "", "## Reproduce", "",
        "```powershell",
        "& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --python soldier.py",
        "```", "",
    ])
    (OUT / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print("VERIFIED", json.dumps({"triangles": triangles, "bytes": path.stat().st_size,
                                  "joints": joints, "clips": clips,
                                  "reimport": measurements, "framing": framing}, indent=2))


if __name__ == "__main__":
    main()
