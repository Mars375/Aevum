"""
Aevum - infrastructure v9 visual QA contact sheet renderer (Blender, headless).

Imports the transient mesh JSON produced by scripts/render-infrastructure-preview.ts
(exact Three.js indexed triangles + per-part material colors), converts each
triangle from Three.js Y-up to Blender Z-up with (x, y, z) -> (x, z, -y),
places the six models on neutral bases in a 3x2 grid, and renders a ~1400x900
orthographic contact sheet with soft lights and readable ASCII/French labels
using Blender's built-in font (no external fonts, no downloads, no GUI).

Run (PowerShell, repo root):
  & "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python scripts/render-infrastructure-preview.py -- <mesh.json> <out.png>

Guards: requires exactly two arguments (<mesh.json> must exist, <out.png> must end
with .png); the output directory is created if missing. No other file is touched
and nothing is deleted. The engine falls back from Eevee to Workbench/Cycles so
the render still completes on CPU-only or GPU-less machines.
"""
import json
import math
import os
import sys

import bpy

GRID_COLS = 3
CELL_X = 2.0
CELL_Y = 2.2
BASE_RADIUS = 0.85
BASE_HEIGHT = 0.1
LABEL_Z = 1.62


def srgb_to_linear(channel: float) -> float:
    """Convert one sRGB channel (0..1) to linear light for our color values."""
    f = max(0.0, min(1.0, channel))
    return f / 12.92 if f <= 0.04045 else ((f + 0.055) / 1.055) ** 2.4


def color_rgba(hex_color: str, alpha: float = 1.0):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def three_to_blender(v):
    """Three.js Y-up -> Blender Z-up: keep X, map Y to Z, map Z to -Y."""
    x, y, z = v
    return (x, z, -y)


def add_standard_material(name: str, hex_color: str, roughness: float = 0.85):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color_rgba(hex_color)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat


def add_part(name, part, cell_x, cell_y, base_z):
    verts = []
    for i in range(0, len(part["positions"]), 3):
        bx, by, bz = three_to_blender(part["positions"][i : i + 3])
        verts.append((cell_x + bx, cell_y + by, base_z + bz))
    faces = [tuple(part["triangles"][i : i + 3]) for i in range(0, len(part["triangles"]), 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(add_standard_material(name + "_mat", part["color"]))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def add_base(cell_x, cell_y, base_z):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=BASE_RADIUS, depth=BASE_HEIGHT, vertices=24,
        location=(cell_x, cell_y, base_z + BASE_HEIGHT / 2),
    )
    obj = bpy.context.object
    obj.name = "base_%s" % cell_x
    obj.data.materials.append(add_standard_material("base_mat", "#3a3f45", 0.9))
    return obj


def add_label(text, cell_x, cell_y, z):
    curve = bpy.data.curves.new("label", type="FONT")
    curve.body = text
    curve.size = 0.32
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.materials.append(add_standard_material("label_mat", "#17191c", 1.0))
    obj = bpy.data.objects.new("label_" + text, curve)
    obj.location = (cell_x, cell_y, z)
    bpy.context.collection.objects.link(obj)
    return obj


def setup_camera(scene, target, radius, height):
    cam_data = bpy.data.cameras.new("preview_cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 7.8
    cam = bpy.data.objects.new("preview_cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (target[0], target[1] - radius, target[2] + height)
    empty = bpy.data.objects.new("preview_target", None)
    empty.location = target
    bpy.context.collection.objects.link(empty)
    track = cam.constraints.new(type="TRACK_TO")
    track.target = empty
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = cam
    return cam


def setup_lights():
    key = bpy.data.lights.new("key_sun", type="SUN")
    key.energy = 3.0
    key.angle = math.radians(12)
    key_obj = bpy.data.objects.new("key_sun", key)
    key_obj.rotation_euler = (math.radians(52), 0.0, math.radians(24))
    bpy.context.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("fill_sun", type="SUN")
    fill.energy = 1.1
    fill.angle = math.radians(18)
    fill_obj = bpy.data.objects.new("fill_sun", fill)
    fill_obj.rotation_euler = (math.radians(38), 0.0, math.radians(-38))
    bpy.context.collection.objects.link(fill_obj)

    soft = bpy.data.lights.new("soft_front", type="AREA")
    soft.energy = 60.0
    soft.size = 6.0
    soft.size_y = 3.0
    soft_obj = bpy.data.objects.new("soft_front", soft)
    soft_obj.location = (1.0, -4.5, 4.5)
    bpy.context.collection.objects.link(soft_obj)


def engine_works(scene, name):
    try:
        scene.render.engine = name
        return scene.render.engine == name
    except Exception:
        return False


def render(scene, out_png):
    """Render with the best available engine; Eevee first, then Workbench/Cycles CPU."""
    engines = ["BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH", "CYCLES"]
    last_error = None
    for name in engines:
        if not engine_works(scene, name):
            continue
        try:
            if name == "CYCLES":
                scene.cycles.samples = 48
                scene.cycles.device = "CPU"
            if name == "BLENDER_WORKBENCH":
                shading = scene.display.shading
                shading.light = "STUDIO"
                shading.color_type = "MATERIAL"
            print("Rendering with engine:", name)
            scene.render.filepath = out_png
            bpy.ops.render.render(write_still=True)
            return name
        except Exception as exc:  # pragma: no cover - engine fallback path
            last_error = exc
            print("Engine %s failed: %s" % (name, exc))
    raise RuntimeError("No render engine worked: %s" % last_error)


def main():
    argv = sys.argv
    pos = -1
    for i, a in enumerate(argv):
        if a == "--":
            pos = i
            break
    if pos >= 0:
        argv = argv[pos + 1 :]
    else:
        argv = [a for a in argv[1:] if not a.startswith("-")]
    mesh_json = argv[0] if len(argv) > 0 else ""
    out_png = argv[1] if len(argv) > 1 else ""
    if not mesh_json or not out_png:
        raise SystemExit("Usage: blender -b --python render-infrastructure-preview.py -- <mesh.json> <out.png>")
    if not os.path.isfile(mesh_json):
        raise SystemExit("Mesh JSON not found: " + mesh_json)
    if not out_png.lower().endswith(".png"):
        raise SystemExit("Output must be a .png file: " + out_png)

    out_dir = os.path.dirname(os.path.abspath(out_png))
    os.makedirs(out_dir, exist_ok=True)

    with open(mesh_json, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    scene = bpy.context.scene
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 900
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.use_motion_blur = False

    world = bpy.data.worlds.new("preview_world")
    world.use_nodes = True
    bg = None
    for node in world.node_tree.nodes:
        if node.type == "BACKGROUND":
            bg = node
            break
    if bg:
        bg.inputs[0].default_value = color_rgba("#d8d3c9")
        bg.inputs[1].default_value = 1.0
    scene.world = world
    world.color = color_rgba("#d8d3c9")[:3]

    setup_lights()

    grid_center = (0.0, 0.0)
    for i, entry in enumerate(manifest["kinds"]):
        col = i % GRID_COLS
        row = i // GRID_COLS
        cell_x = (col - 1) * CELL_X
        cell_y = (1 - row) * CELL_Y
        add_base(cell_x, cell_y, 0.0)
        for p, part in enumerate(entry["parts"]):
            add_part("m_%s_%d" % (entry["kind"], p), part, cell_x, cell_y, BASE_HEIGHT)
        add_label(entry["label"], cell_x, cell_y, LABEL_Z)

    target = (0.0, 0.55, 0.35)
    setup_camera(scene, target, radius=9.5, height=6.8)


    engine_used = render(scene, out_png)
    print("WROTE %s (%s) %dx%d" % (out_png, engine_used, scene.render.resolution_x, scene.render.resolution_y))


main()