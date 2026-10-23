"""The papercraft snowman explorer, rebuilt in Blender to match src/player.js.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P snowman.py -- \
      --samples 128 --res 1200 1500 --out renders/snowman.png --blend snowman.blend

Every part is authored in the same units and axes as player.js (Y up, face toward +Z) under one root
that is turned to Blender's Z up, so numbers can be copied across in either direction. Objects use the
ZYX rotation mode, which is the same rotation as a Three.js "XYZ" Euler.
"""
import bpy, bmesh, math, random, sys, os, argparse, colorsys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--res", type=int, nargs=2, default=[1200, 1500])
ap.add_argument("--out", default="renders/snowman.png")
ap.add_argument("--blend", default="", help="also save the scene for hand editing")
args = ap.parse_args(argv)
HERE = os.path.dirname(os.path.abspath(__file__))

random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- colours (from player.js)

COAL, CHEEK, CARROT, WOOD = "#2e2a2b", "#f4b096", "#f2780f", "#7a4a2c"
WOOL, HAT, HOLLY, BERRY = "#d8403a", "#3a3536", "#4c8a3f", "#c8282b"
SNOW_TONES = ["#fcf9f3", "#f6eedf", "#f1e5cf", "#e9ecee"]

def srgb(hex_):
    return tuple(int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5))

def linear(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def shifted(hex_, spread):
    """A colour with its lightness nudged at random, like Three's offsetHSL in facets()."""
    h, l, s = colorsys.rgb_to_hls(*srgb(hex_))
    return linear(colorsys.hls_to_rgb(h, max(0, min(1, l + random.uniform(-spread, spread))), s))

# ---------------------------------------------------------------- scene graph

def link(ob, parent=None):
    scene.collection.objects.link(ob)
    ob.rotation_mode = "ZYX"
    if parent: ob.parent = parent
    return ob

def group(name, parent=None, pos=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    ob = link(bpy.data.objects.new(name, None), parent)
    ob.location = pos; ob.rotation_euler = rot; ob.scale = (scale,) * 3
    return ob

CARD = None  # the one matte card material, set up below

def card(name, bm, color, spread, parent, pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), tones=None):
    """Flat-shaded mesh where each facet takes a slightly different tone of `color` (or of `tones`)."""
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    attr = me.color_attributes.new("tone", "FLOAT_COLOR", "CORNER")
    for p in me.polygons:
        c = shifted(random.choice(tones) if tones else color, spread)
        for li in p.loop_indices:
            attr.data[li].color = (*c, 1)
    me.materials.append(CARD)
    ob = link(bpy.data.objects.new(name, me), parent)
    ob.location = pos; ob.rotation_euler = rot; ob.scale = scale
    return ob

# ---------------------------------------------------------------- geometry, Three.js style (Y up)

def cylinder(r_top, r_bot, h, sides, rows=1, y0=None):
    """Like THREE.CylinderGeometry: axis along Y, centred unless y0 gives the bottom."""
    bm = bmesh.new()
    lo = -h / 2 if y0 is None else y0
    rings = []
    for k in range(rows + 1):
        t = k / rows
        r, y = r_bot + (r_top - r_bot) * t, lo + h * t
        rings.append([bm.verts.new((r * math.sin(2 * math.pi * i / sides), y, r * math.cos(2 * math.pi * i / sides)))
                      for i in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def ico(radius, subdiv=0):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    return bm

def torus(R, r, radial, tubular):
    """Like THREE.TorusGeometry: lies in the XY plane around Z."""
    bm = bmesh.new(); rings = []
    for i in range(tubular):
        u = 2 * math.pi * i / tubular
        rings.append([bm.verts.new(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v)))
                      for v in (2 * math.pi * j / radial for j in range(radial))])
    for i in range(tubular):
        a, b = rings[i], rings[(i + 1) % tubular]
        for j in range(radial):
            k = (j + 1) % radial
            bm.faces.new((a[j], b[j], b[k], a[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def box(w, h, d):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(w, h, d), verts=bm.verts)
    return bm

def octa(r):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r), (0, 0, -r))]
    for a in (0, 1):
        for b in (2, 3):
            for c in (4, 5):
                bm.faces.new((v[a], v[b], v[c]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def tube(points, radius, sides=4):
    """A square-section strip through straight segments, like THREE.TubeGeometry on a line path."""
    bm = bmesh.new(); rings = []
    pts = [Vector(p) for p in points]
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = t.cross(Vector((0, 0, 1))).normalized(); b = t.cross(n)
        rings.append([bm.verts.new(p + radius * (math.cos(a) * n + math.sin(a) * b))
                      for a in (2 * math.pi * (k + 0.5) / sides for k in range(sides))])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            j = (k + 1) % sides
            bm.faces.new((a[k], a[j], b[j], b[k]))
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def rand_dir():
    v = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, 1)))
    return v.normalized()

# ---------------------------------------------------------------- material

def card_material():
    m = bpy.data.materials.new("Card")
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    b = N["Principled BSDF"]
    b.inputs["Roughness"].default_value = 1.0
    at = N.new("ShaderNodeAttribute"); at.attribute_name = "tone"
    L.new(at.outputs["Color"], b.inputs["Base Color"])
    return m

CARD = card_material()

# ---------------------------------------------------------------- snowman (player.js numbers)

BODY, SQUASH, HEAD = 0.38, 1.27, 0.29
NECK = 0.4
WIDE, BASE, BELL = 1.06, -0.6, 0.35
bell_width = lambda h: WIDE * (1 - BELL * h)

def snowball(radius, shape=lambda v: v):
    """Geodesic sphere with each corner nudged along the surface, so facets are a little irregular."""
    bm = ico(radius, 2)
    for v in bm.verts:
        n = rand_dir() * radius * 0.035
        n -= v.co * (n.dot(v.co) / v.co.length_squared)
        p = v.co + n; p.length = radius * random.uniform(0.99, 1.01)
        v.co = shape(p)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
    return bm

def body_shape(v):
    w = bell_width(v.y / BODY)
    return Vector((v.x * w, max(v.y, BASE * BODY), v.z * w))

# The root turns Three's Y-up, face-toward-+Z into Blender's Z-up, face-toward -Y.
root = group("Snowman", rot=(math.pi / 2, 0, 0))
root.rotation_mode = "XYZ"

body_y = BODY * SQUASH * -BASE - 0.005
head_y = body_y + NECK + HEAD
body = group("Body", root, (0, body_y, 0))
head = group("Head", root, (0, head_y, 0))
body_mesh = card("BodySnow", snowball(BODY, body_shape), None, 0.015, body, scale=(1, SQUASH, 1), tones=SNOW_TONES)
card("HeadSnow", snowball(HEAD), None, 0.015, head, tones=SNOW_TONES)

# The face and hat are laid out for a head of radius 0.2 and scaled to fit.
face = group("Face", head, scale=HEAD / 0.2)
on_head = lambda x, y: math.sqrt(0.04 - x * x - y * y) - 0.004

def coal_lump(radius):
    bm = ico(radius, 0)
    for v in bm.verts: v.co *= random.uniform(0.8, 1.15)
    return bm

EYE_X, EYE_Y, CHEEK_X, CHEEK_Y = 0.078, 0.045, 0.115, -0.01
for side in (-1, 1):
    card("Eye", coal_lump(0.02), COAL, 0.08, face, (side * EYE_X, EYE_Y, on_head(EYE_X, EYE_Y) + 0.004),
         (0, side * math.asin(EYE_X / 0.2), 0), (1, 1, 0.65))
    # Three's CircleGeometry is a flat hexagon facing +Z.
    bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=6, radius=0.022)
    card("Cheek", bm, CHEEK, 0.04, face, (side * CHEEK_X, CHEEK_Y, on_head(CHEEK_X, CHEEK_Y) + 0.006),
         (0, side * math.asin(CHEEK_X / 0.2), 0))

# The gentle smile (player.js morphs it deeper when the snowman beams).
SMILE_HALF, SMILE_BOTTOM, SMILE_R, SMILE_SEGS = 0.075, -0.085, 0.11, 5
half = math.asin(SMILE_HALF / SMILE_R)
smile = []
for i in range(SMILE_SEGS + 1):
    a = (i / SMILE_SEGS * 2 - 1) * half
    x, y = SMILE_R * math.sin(a), SMILE_BOTTOM + SMILE_R * (1 - math.cos(a))
    smile.append((x, y, on_head(x, y) + 0.006))
card("Smile", tube(smile, 0.009), COAL, 0.05, face)

NOSE_LEN, NOSE_TURN = 0.17, 0.25
nose_pos = Vector((math.sin(NOSE_TURN), 0, math.cos(NOSE_TURN))) * (NOSE_LEN / 2) + Vector((0, 0, 0.192))
card("Carrot", cylinder(0.002, 0.034, NOSE_LEN, 6, 3), CARROT, 0.1, face, nose_pos, (math.pi / 2, 0, -NOSE_TURN))

hat = group("Hat", face, (0, 0.11, 0), (-0.08, 0, 0.12))
card("Brim", cylinder(0.27, 0.27, 0.025, 10), HAT, 0.06, hat)
card("Crown", cylinder(0.15, 0.165, 0.24, 8), HAT, 0.08, hat, (0, 0.13, 0))
card("Band", cylinder(0.168, 0.17, 0.055, 8), WOOL, 0.08, hat, (0, 0.045, 0))
for side in (-1, 1):
    card("Holly", octa(0.035), HOLLY, 0.12, hat, (-0.08 + side * 0.03, 0.09, 0.15), (-0.3, 0, side * 0.7),
         (0.55, 1.4, 0.25))
for x, y in ((-0.095, 0.05), (-0.07, 0.045), (-0.083, 0.068)):
    card("Berry", ico(0.017), BERRY, 0.1, hat, (x, y, 0.17))

# Three coal buttons, each seated on the body facet in front of it and turned to lie flat on it.
bpy.context.view_layer.update()
for y in (0.24, 0.09, -0.06):
    hit, loc, normal, _ = body_mesh.ray_cast(Vector((0.04, y / SQUASH, 1)), Vector((0, 0, -1)))
    n = Vector((normal.x, normal.y / SQUASH, normal.z)).normalized()
    b = card("Button", ico(0.032), COAL, 0.06, body, (loc.x, loc.y * SQUASH, loc.z), scale=(1, 1, 0.45))
    b.rotation_mode = "QUATERNION"
    b.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(n)

# Stick arms that reach up and out, forking into twigs near the top.
for side in (-1, 1):
    arm = group("Arm", body, (side * 0.28, 0.19, 0), (0, 0, -side * 0.62))
    card("Stick", cylinder(0.016, 0.024, 0.36, 5, y0=0), WOOD, 0.08, arm)
    for y, bend in ((0.24, 0.7), (0.3, -0.55)):
        card("Twig", cylinder(0.009, 0.014, 0.11, 4, y0=0), WOOD, 0.08, arm, (0, y, 0), (0, 0, side * bend))

# Red scarf round the neck, with a tail of two folded panels down the front.
card("Scarf", torus(0.17, 0.05, 4, 12), WOOL, 0.1, body, (0, 0.43, 0), (math.pi / 2, 0, 0))
for y, z, length, tilt in ((0.335, 0.242, 0.18, 0.59), (0.18, 0.34, 0.186, 0.54)):
    card("ScarfTail", box(0.095, length, 0.02), WOOL, 0.1, body, (-0.07, y, z), (-tilt, -0.2, 0))

# ---------------------------------------------------------------- stage

# A soft snow ground with a few low lumps, in the same faceted card.
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, segments=48, radius=6)
bmesh.ops.triangulate(bm, faces=bm.faces)
bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=3, use_grid_fill=True)
for v in bm.verts:
    d = v.co.length
    v.co.z = random.uniform(-0.008, 0.008) - 0.002 * max(0, d - 1.5) ** 2
ground = card("Ground", bm, None, 0.012, None, tones=SNOW_TONES)
ground.rotation_mode = "XYZ"
for x, y, s in ((-1.4, 1.2, 0.35), (1.7, 1.8, 0.45), (-0.9, -1.6, 0.2), (2.2, -0.4, 0.25)):
    lump = card("Lump", ico(1, 1), None, 0.015, None, (x, y, -0.02), scale=(s, s * 0.8, s * 0.3), tones=SNOW_TONES)
    lump.rotation_mode = "XYZ"

sun_d = bpy.data.lights.new("Sun", "SUN")
sun_d.energy = 3.2; sun_d.color = (1.0, 0.86, 0.72); sun_d.angle = math.radians(6)
sun = bpy.data.objects.new("Sun", sun_d); scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(-35))

world = bpy.data.worlds.new("World"); scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.55, 0.66, 0.88, 1); bg.inputs["Strength"].default_value = 0.9

cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 60
cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam)
cam.location = (-1.6, -3.8, 1.35)  # from the left, so the carrot (turned to its right) shows its length
target = Vector((0, 0, 0.74))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

r = scene.render
r.engine = "CYCLES"
r.resolution_x, r.resolution_y = args.res
r.resolution_percentage = 100
r.filepath = os.path.join(HERE, args.out)
r.image_settings.file_format = "PNG"
c = scene.cycles
c.samples = args.samples; c.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    c.device = "GPU"
except Exception as e:
    print("GPU setup failed, using CPU:", e)

vs = scene.view_settings
vs.view_transform = "AgX"
vs.exposure = -0.1

if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, args.blend))
if args.out:
    bpy.ops.render.render(write_still=True)
