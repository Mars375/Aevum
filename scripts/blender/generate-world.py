"""Aevum miniature kit. Run with Blender --background --python this-file.

Original procedural assets, no external textures. Z-up Blender exports as Y-up
glTF. Every model shares a ground origin and fits approximately one map parcel.
"""
import bpy
import math
import os
import random

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'apps/player/public/models/world')
os.makedirs(OUT, exist_ok=True)
random.seed(42)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color):
    # UI palette values are sRGB; Blender's node inputs are linear.
    color = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in color)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        bsdf = m.node_tree.nodes.new('ShaderNodeBsdfPrincipled')
        output = m.node_tree.nodes.new('ShaderNodeOutputMaterial')
        m.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .85
    return m

stone = material('Limestone', (.68, .63, .48))
plaster = material('Ivory plaster', (.91, .82, .60))
roof = material('Oxidised copper', (.19, .36, .34))
wood = material('Walnut', (.28, .17, .10))
leaf = material('Pine green', (.13, .34, .22))
leaf_light = material('Sunlit foliage', (.31, .49, .27))
rock = material('Slate', (.43, .47, .46))
snow = material('Pale granite', (.71, .73, .64))
gold = material('Wheat', (.75, .56, .24))
dark = material('Doorways', (.09, .15, .15))
cloth = material('Faction cloth', (.85, .85, .85))
skin = material('Skin', (.72, .48, .31))
iron = material('Forged iron', (.48, .56, .58))
leather = material('Leather', (.22, .13, .09))

parts = []
def finish(obj, mat):
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj

def cube(loc, scale, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Hand cut edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, mat)

def cone(loc, r1, r2, depth, mat, vertices=7):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc)
    return finish(bpy.context.object, mat)

def ico(loc, scale, mat, subdivision=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivision, radius=1, location=loc)
    obj=bpy.context.object
    obj.scale=scale
    return finish(obj,mat)

def house(x,y,s=1):
    cube((x,y,.15*s),(.30*s,.26*s,.30*s),plaster,.012*s)
    # Gabled roof, ridge parallel to Y.
    verts=[(-.18,-.16,0),(.18,-.16,0),(0,-.16,.16),(-.18,.16,0),(.18,.16,0),(0,.16,.16)]
    mesh=bpy.data.meshes.new('Gable')
    mesh.from_pydata([(x+a*s,y+b*s,.30*s+c*s) for a,b,c in verts],[],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)])
    obj=bpy.data.objects.new('Roof',mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj,roof)
    cube((x,y-.132*s,.075*s),(.065*s,.015*s,.15*s),dark)
    cube((x+.084*s,y-.135*s,.20*s),(.052*s,.012*s,.07*s),gold)
    cube((x+.08*s,y+.04*s,.41*s),(.043*s,.045*s,.15*s),stone)

def tower(x,y,h=.65,r=.11):
    cone((x,y,h/2),r,r*.9,h,stone,8)
    cone((x,y,h+.09),r*1.5,0,.22,roof,8)
    cube((x,y-r,.48*h),(.034,.015,.10),dark)

def export(name):
    global parts
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=name
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',use_selection=True,export_materials='EXPORT',export_yup=True)
    obj.hide_set(True)
    parts=[]

cone((0,0,.22),.04,.026,.44,wood,6)
for z,r in [(.28,.23),(.45,.19),(.62,.14)]: cone((0,0,z),r,0,.38,leaf,7)
export('pine')

cone((0,0,.22),.044,.025,.44,wood,6)
for x,y,z,s in [(0,0,.48,.23),(-.14,.03,.39,.19),(.13,-.04,.42,.20),(.02,.02,.65,.17)]:
    ico((x,y,z),(s,s*.85,s),leaf_light,1)
export('tree')

ico((0,0,.25),(.39,.30,.50),rock)
ico((-.21,.09,.13),(.19,.24,.27),snow)
ico((.22,-.04,.10),(.20,.21,.20),rock)
export('rock')

house(-.13,.05,.95)
house(.20,.13,.62)
cube((0,-.24,.018),(.64,.13,.035),stone,.01)
export('hamlet')

house(-.22,-.16,.9)
house(.22,-.13,.83)
house(-.20,.22,.65)
tower(.12,.20,.64,.105)
cube((0,0,.014),(.76,.73,.028),stone,.04)
export('town')

cube((0,0,.04),(.80,.72,.08),stone,.035)
cube((0,.04,.27),(.43,.35,.45),plaster,.016)
cone((0,.04,.59),.33,0,.31,roof,4).rotation_euler.z=math.pi/4
for x in [-.31,.31]:
    for y in [-.26,.26]: tower(x,y,.54,.085)
cube((0,-.28,.16),(.50,.085,.23),stone)
cube((0,-.33,.12),(.11,.012,.17),dark)
export('citadel')

cube((0,0,.025),(.70,.64,.05),wood,.02)
for x in range(6):
    cube((-.27+x*.105,0,.055),(.060,.57,.06),gold)
house(.18,.23,.4)
export('farm')

ico((0,.08,.16),(.33,.23,.30),rock)
cube((0,-.13,.12),(.21,.07,.24),wood)
cube((0,-.174,.10),(.13,.015,.19),dark)
for x in [-.09,.09]: cube((x,-.31,.018),(.024,.35,.035),wood)
export('mine')

for x,y,h in [(-.23,-.18,.19),(.21,.15,.27),(-.19,.17,.31),(.18,-.19,.1)]:
    cube((x,y,h/2),(.12,.13,h),stone,.018)
for i in range(7): ico((random.uniform(-.25,.25),random.uniform(-.2,.2),.035),(.06,.05,.05),rock)
export('ruins')

def person(x=0, y=0, soldier=False):
    # Oversized heads and tools remain readable at atlas scale.
    for dx in [-.045, .045]:
        cube((x+dx,y,.085),(.052,.065,.17),leather,.006)
    cone((x,y,.235),.095,.065,.18,cloth,6)
    ico((x,y,.385),(.066,.061,.078),skin,2)
    for dx in [-.105,.105]:
        cube((x+dx,y-.005,.25),(.045,.06,.15),cloth,.005)
        ico((x+dx,y-.012,.17),(.025,.028,.03),skin)
    cube((x,y,.177),(.16,.12,.028),leather)
    if soldier:
        ico((x,y,.425),(.076,.069,.055),iron,1)
        cube((x,y+.012,.477),(.028,.09,.055),cloth)
    else:
        cone((x,y,.435),.11,.11,.018,gold,10)
        cone((x,y,.46),.062,.03,.055,gold,8)

person(soldier=True)
cone((.14,0,.29),.012,.012,.58,wood,6)
cone((.14,0,.62),.035,0,.10,iron,4)
cube((-.12,-.06,.25),(.14,.038,.20),iron,.018)
cube((-.12,-.084,.25),(.11,.012,.17),cloth,.015)
export('soldier')

person()
cone((.14,0,.22),.011,.011,.44,wood,6)
cube((.14,-.035,.035),(.15,.035,.035),iron)
export('farmer')

person()
cone((.14,0,.25),.014,.014,.42,wood,6)
cube((.17,0,.40),(.12,.045,.09),iron,.007)
cone((-.19,.09,.08),.07,.07,.16,wood,8)
export('lumberjack')

person()
cone((.14,0,.25),.012,.012,.43,wood,6)
cube((.14,0,.43),(.22,.025,.03),iron,.006)
ico((-.16,.06,.055),(.075,.065,.055),iron)
export('miner')

person(-.18,0)
cube((.16,.08,.15),(.24,.32,.07),wood,.01)
for x in [.015,.305]:
    wheel=cone((x,.10,.10),.10,.10,.035,leather,10)
    wheel.rotation_euler.y=math.pi/2
for y in [-.06,.22]: cube((.16,y,.24),(.26,.025,.15),wood)
for x in [.04,.28]: cube((x,.08,.24),(.025,.30,.15),wood)
ico((.16,.04,.24),(.075,.10,.11),gold)
cube((.17,.17,.27),(.13,.10,.12),cloth,.01)
export('merchant')

# Keep an editable source scene, arranged as a small catalogue.
for index,obj in enumerate([o for o in bpy.context.scene.objects if o.type=='MESH']):
    obj.hide_set(False)
    obj.location=(index%3*1.8,index//3*1.8,0)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'scripts/blender/aevum-world-kit.blend'))
print('AEVUM: exported 14 original GLB models to '+OUT)
