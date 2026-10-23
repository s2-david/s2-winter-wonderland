"""Low-poly winter diorama: a small Scandinavian house on a snowy tile.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P winter_house.py -- \
      --variant dusk --samples 256 --res 1600 1200 --out renders/house_dusk.png

Variants: "day" (golden afternoon) and "dusk" (blue hour, windows doing the work).
Everything is built from code so the look can be tuned and ported to Three.js.
"""
import bpy, bmesh, math, random, sys, os, argparse
from mathutils import Matrix, Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--variant", default="dusk")
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--res", type=int, nargs=2, default=[1600, 1200])
ap.add_argument("--out", default="renders/house.png")
ap.add_argument("--blend", default="")
ap.add_argument("--export", default="", help="write every house design as one baked GLB for the web")
ap.add_argument("--bake-size", type=int, default=2048)
ap.add_argument("--closeup", action="store_true", help="frame the red house instead of the whole tile")
ap.add_argument("--lineup", action="store_true", help="render every house design side by side")
args = ap.parse_args(argv)
DUSK = args.variant == "dusk"
HERE = os.path.dirname(os.path.abspath(__file__))

random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- helpers

def lerp(a, b, t): return a + (b - a) * t
def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def link(ob, parent=None):
    scene.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def empty(name, loc=(0, 0, 0), rz=0.0, parent=None):
    ob = bpy.data.objects.new(name, None)
    ob.location = loc; ob.rotation_euler.z = rz
    return link(ob, parent)

def from_bm(name, bm, mats, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in (mats if isinstance(mats, list) else [mats]):
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    ob.location = loc; ob.rotation_euler = rot
    return link(ob, parent)

def jitter(bm, amt):
    for v in bm.verts:
        v.co += Vector((random.uniform(-amt, amt) for _ in range(3)))

def bevel(ob, width, segs=2):
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width; m.segments = segs; m.limit_method = "ANGLE"
    return ob

def box(name, loc, size, mat, parent=None, rot=(0, 0, 0), bev=0.012, segs=2, jit=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if jit: jitter(bm, jit)
    ob = from_bm(name, bm, mat, loc, rot, parent)
    return bevel(ob, bev, segs) if bev else ob

def cone(name, loc, r1, r2, depth, mat, segs=8, parent=None, rot=(0, 0, 0), jit=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=depth)
    if jit: jitter(bm, jit)
    return from_bm(name, bm, mat, loc, rot, parent)

def blob(name, loc, size, mat, subdiv=1, jit=0.18, parent=None, rz=None):
    """Faceted lump: snow drifts, rocks, smoke puffs."""
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1)
    jitter(bm, jit)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    return from_bm(name, bm, mat, loc, (0, 0, random.uniform(0, 6.3) if rz is None else rz), parent)

def soft(ob):
    """Smooth-shade an object so snow reads as soft, rounded drifts instead of hard facets."""
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def no_shadow(ob):
    ob.visible_shadow = False
    return ob

# ---------------------------------------------------------------- materials

def node_mat(name):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes["Principled BSDF"]

def mat(name, color, rough=0.7, emit=None, strength=0.0, metal=0.0, sss=0.0,
        coat=0.0, trans=0.0, ior=1.45):
    m, N, L, b = node_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["IOR"].default_value = ior
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (0.5, 0.75, 1.0)
        b.inputs["Subsurface Scale"].default_value = 0.08
    if coat: b.inputs["Coat Weight"].default_value = coat
    if trans: b.inputs["Transmission Weight"].default_value = trans
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m

def add_bump(m, height_socket, strength, distance=0.02):
    N, L = m.node_tree.nodes, m.node_tree.links
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    L.new(height_socket, bump.inputs["Height"])
    L.new(bump.outputs["Normal"], N["Principled BSDF"].inputs["Normal"])

def mix_color(N, L, fac_socket, a, b, out_socket):
    mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"
    L.new(fac_socket, mx.inputs[0])
    mx.inputs[6].default_value = (*a, 1); mx.inputs[7].default_value = (*b, 1)
    L.new(mx.outputs[2], out_socket)
    return mx

def wood_mat(name, color, board=0.15, vary=0.25):
    """Vertical board siding: grooves every `board` metres plus per-board tint."""
    m = mat(name, color, rough=0.72)
    N, L = m.node_tree.nodes, m.node_tree.links
    tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Object"], sep.inputs[0])
    add = N.new("ShaderNodeMath"); add.operation = "ADD"
    L.new(sep.outputs[0], add.inputs[0]); L.new(sep.outputs[1], add.inputs[1])
    mul = N.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 1 / board
    L.new(add.outputs[0], mul.inputs[0])
    fr = N.new("ShaderNodeMath"); fr.operation = "FRACT"; L.new(mul.outputs[0], fr.inputs[0])
    groove = N.new("ShaderNodeMapRange"); groove.inputs[2].default_value = 0.07
    L.new(fr.outputs[0], groove.inputs[0])
    add_bump(m, groove.outputs[0], 0.35, 0.01)
    fl = N.new("ShaderNodeMath"); fl.operation = "FLOOR"; L.new(mul.outputs[0], fl.inputs[0])
    wn = N.new("ShaderNodeTexWhiteNoise"); wn.noise_dimensions = "1D"
    L.new(fl.outputs[0], wn.inputs["W"])
    dark = tuple(c * (1 - vary) for c in color)
    mix_color(N, L, wn.outputs["Value"], dark, color, N["Principled BSDF"].inputs["Base Color"])
    return m

def noisy_mat(name, a, b, scale=6.0, rough=0.8, bump=0.25, **kw):
    m = mat(name, a, rough=rough, **kw)
    N, L = m.node_tree.nodes, m.node_tree.links
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 4
    mix_color(N, L, nz.outputs["Fac"], a, b, N["Principled BSDF"].inputs["Base Color"])
    if bump: add_bump(m, nz.outputs["Fac"], bump, 0.03)
    return m

def snow_mat(name, color):
    m = mat(name, color, rough=0.6, sss=0.25)
    N, L = m.node_tree.nodes, m.node_tree.links
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 14
    nz.inputs["Detail"].default_value = 6
    add_bump(m, nz.outputs["Fac"], 0.12, 0.02)
    return m

def ice_mat():
    m = mat("Ice", (0.40, 0.72, 0.84), rough=0.12, trans=0.25, ior=1.31, coat=0.3)
    N, L = m.node_tree.nodes, m.node_tree.links
    b = N["Principled BSDF"]
    vo = N.new("ShaderNodeTexVoronoi"); vo.feature = "DISTANCE_TO_EDGE"
    vo.inputs["Scale"].default_value = 1.6
    crack = N.new("ShaderNodeMapRange")
    crack.inputs[1].default_value = 0.0; crack.inputs[2].default_value = 0.018
    crack.inputs[3].default_value = 1.0; crack.inputs[4].default_value = 0.0
    L.new(vo.outputs["Distance"], crack.inputs[0])
    nz = N.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.5
    base = mix_color(N, L, nz.outputs["Fac"], (0.16, 0.50, 0.64), (0.45, 0.78, 0.86), b.inputs["Base Color"])
    # cracks read as frosted white lines in the ice
    mix2 = N.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    L.new(crack.outputs[0], mix2.inputs[0]); L.new(base.outputs[2], mix2.inputs[6])
    mix2.inputs[7].default_value = (0.92, 0.96, 1.0, 1)
    L.new(mix2.outputs[2], b.inputs["Base Color"])
    rr = N.new("ShaderNodeMapRange"); rr.inputs[3].default_value = 0.04; rr.inputs[4].default_value = 0.5
    L.new(crack.outputs[0], rr.inputs[0]); L.new(rr.outputs[0], b.inputs["Roughness"])
    return m

def brick_mat():
    """Running-bond bricks on all four chimney faces, laid in object space so courses line up."""
    m = mat("Brick", (0.45, 0.17, 0.10), rough=0.85)
    N, L = m.node_tree.nodes, m.node_tree.links
    tc = N.new("ShaderNodeTexCoord"); sep = N.new("ShaderNodeSeparateXYZ")
    L.new(tc.outputs["Object"], sep.inputs[0])
    add = N.new("ShaderNodeMath"); add.operation = "ADD"
    L.new(sep.outputs[0], add.inputs[0]); L.new(sep.outputs[1], add.inputs[1])
    co = N.new("ShaderNodeCombineXYZ")
    L.new(add.outputs[0], co.inputs[0]); L.new(sep.outputs[2], co.inputs[1])
    br = N.new("ShaderNodeTexBrick")
    br.offset = 0.5
    br.inputs["Color1"].default_value = (0.40, 0.14, 0.08, 1)
    br.inputs["Color2"].default_value = (0.56, 0.24, 0.13, 1)
    br.inputs["Mortar"].default_value = (0.66, 0.63, 0.58, 1)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.008
    br.inputs["Bias"].default_value = 0.2
    br.inputs["Brick Width"].default_value = 0.11
    br.inputs["Row Height"].default_value = 0.05
    L.new(co.outputs[0], br.inputs["Vector"])
    L.new(br.outputs["Color"], N["Principled BSDF"].inputs["Base Color"])
    add_bump(m, br.outputs["Fac"], 0.3, 0.01)
    return m

WARM = (1.0, 0.48, 0.14)
GLOW = 9.0 if DUSK else 5.0

M = dict(
    snow=snow_mat("Snow", (0.90, 0.92, 0.95)),
    snow_roof=snow_mat("SnowRoof", (0.93, 0.94, 0.97)),
    clay=mat("Clay", (0.80, 0.81, 0.83), rough=0.9),
    bed=noisy_mat("PondBed", (0.04, 0.16, 0.22), (0.08, 0.26, 0.32), scale=3, bump=0),
    ice=ice_mat(),
    falu=wood_mat("FaluRed", (0.42, 0.055, 0.035)),
    ochre=wood_mat("Ochre", (0.72, 0.45, 0.12)),
    trim=mat("Trim", (0.88, 0.87, 0.83), rough=0.55),
    roof=noisy_mat("RoofTar", (0.07, 0.065, 0.06), (0.12, 0.11, 0.10), scale=20, rough=0.85, bump=0.1),
    stone=noisy_mat("Stone", (0.30, 0.30, 0.31), (0.50, 0.49, 0.48), scale=9, bump=0.4),
    rock=noisy_mat("Rock", (0.36, 0.37, 0.39), (0.55, 0.55, 0.56), scale=4, bump=0.3),
    glass=mat("WindowGlow", WARM, rough=0.3, emit=WARM, strength=GLOW),
    curtain=mat("Curtain", (0.95, 0.85, 0.65), rough=0.9, emit=(1.0, 0.75, 0.45), strength=GLOW * 0.25),
    door=wood_mat("Door", (0.07, 0.17, 0.19), board=0.1, vary=0.15),
    iron=mat("Iron", (0.03, 0.03, 0.035), rough=0.45, metal=0.8),
    brass=mat("Brass", (0.8, 0.6, 0.3), rough=0.3, metal=1.0),
    lamp=mat("LampGlow", (1.0, 0.75, 0.4), emit=(1.0, 0.68, 0.35), strength=GLOW * 0.9),
    pine=noisy_mat("Pine", (0.20, 0.30, 0.10), (0.30, 0.40, 0.14), scale=5, rough=0.85, bump=0.15),
    bark=noisy_mat("Bark", (0.20, 0.10, 0.05), (0.30, 0.17, 0.09), scale=12, bump=0.3),
    logend=mat("LogEnd", (0.78, 0.60, 0.38), rough=0.8),
    fence=noisy_mat("Fence", (0.36, 0.30, 0.25), (0.48, 0.42, 0.36), scale=10, bump=0.2),
    red=mat("SledRed", (0.55, 0.05, 0.04), rough=0.45, coat=0.4),
    wreath=noisy_mat("Wreath", (0.06, 0.18, 0.06), (0.12, 0.28, 0.10), scale=30, bump=0.4),
    smoke=mat("Smoke", (0.80, 0.80, 0.82), rough=1.0),
    brick=brick_mat(),
    shutter=wood_mat("Shutter", (0.10, 0.16, 0.12), board=0.06, vary=0.2),
    # Walls for the web export are baked near-white; the browser tints them per house.
    wall_neutral=wood_mat("WallNeutral", (0.82, 0.82, 0.80)),
    bush=noisy_mat("Bush", (0.07, 0.16, 0.08), (0.13, 0.25, 0.10), scale=9, rough=0.9, bump=0.3),
)

# ---------------------------------------------------------------- terrain

S = 5.0                       # tile half-size
POND = (2.05, -2.15, 2.15, 1.45)
FLAT = [(-1.3, 0.7, 1.55, 1.85, 0.14), (2.55, 2.55, 0.95, 1.05, 0.16)]  # cx, cy, hx, hy, z
PATH = [(-1.75, -0.65), (-1.6, -1.35), (-0.7, -1.85), (0.25, -2.05)]
ICE_Z = -0.07

def seg_dist(px, py, a, b):
    ax, ay = a; bx, by = b
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

def H(x, y):
    z = 0.12 + 0.09 * noise.noise(Vector((x * 0.5, y * 0.5, 1.3)))
    z += 1.25 * math.exp(-(((x + 1.6) / 2.9) ** 2 + ((y - 4.6) / 1.7) ** 2))
    z += 0.75 * math.exp(-(((x - 4.2) / 1.5) ** 2 + ((y - 3.4) / 2.2) ** 2))
    z += 0.45 * math.exp(-(((x + 4.6) / 1.2) ** 2 + ((y + 0.5) / 2.5) ** 2))
    for cx, cy, hx, hy, fz in FLAT:
        d = math.hypot(max(0, abs(x - cx) - hx), max(0, abs(y - cy) - hy))
        z = lerp(fz, z, smooth(d / 0.9))
    px, py, rx, ry = POND
    d = math.hypot((x - px) / rx, (y - py) / ry) + 0.12 * noise.noise(Vector((x, y, 7.0)))
    z -= 0.58 * smooth((1.15 - d) / 0.75)
    pd = min(seg_dist(x, y, PATH[i], PATH[i + 1]) for i in range(len(PATH) - 1))
    z -= 0.05 * smooth(1 - pd / 0.35)
    return z

def build_terrain():
    n = 34; step = 2 * S / n
    bm = bmesh.new(); grid = {}
    for j in range(n + 1):
        for i in range(n + 1):
            x, y = -S + i * step, -S + j * step
            if 0 < i < n: x += random.uniform(-0.3, 0.3) * step
            if 0 < j < n: y += random.uniform(-0.3, 0.3) * step
            grid[i, j] = bm.verts.new((x, y, H(x, y)))
    for j in range(n):
        for i in range(n):
            a, b, c, d = grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]
            if (i + j) % 2: bm.faces.new((a, b, c)); bm.faces.new((a, c, d))
            else: bm.faces.new((a, b, d)); bm.faces.new((b, c, d))
    # skirt down to the clay base so the snow layer reads as a slab
    ring = [grid[i, 0] for i in range(n)] + [grid[n, j] for j in range(n)] + \
           [grid[i, n] for i in range(n, 0, -1)] + [grid[0, j] for j in range(n, 0, -1)]
    low = [bm.verts.new((v.co.x, v.co.y, -0.5)) for v in ring]
    for k in range(len(ring)):
        k2 = (k + 1) % len(ring)
        bm.faces.new((ring[k], ring[k2], low[k2], low[k]))
    bm.faces.new(list(reversed(low)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        c = f.calc_center_median()
        f.material_index = 1 if (c.z < ICE_Z - 0.08 and abs(c.x) < S - 0.01 and abs(c.y) < S - 0.01 and f.normal.z > 0) else 0
    from_bm("Terrain", bm, [M["snow"], M["bed"]])

build_terrain()
box("Base", (0, 0, -1.45), (2 * S, 2 * S, 1.9), M["clay"], bev=0.04, segs=3)

# ice: a faceted disc under the terrain; terrain hides it outside the shoreline
bm = bmesh.new()
px, py, rx, ry = POND
rings, segs = 5, 28
center = bm.verts.new((px, py, ICE_Z))
prev = None
for r in range(1, rings + 1):
    t = r / rings
    cur = []
    for s in range(segs):
        a = 2 * math.pi * (s + 0.5 * (r % 2)) / segs
        cur.append(bm.verts.new((px + math.cos(a) * rx * 1.25 * t + random.uniform(-.06, .06),
                                 py + math.sin(a) * ry * 1.25 * t + random.uniform(-.06, .06),
                                 ICE_Z + random.uniform(-0.003, 0.003))))
    for s in range(segs):
        s2 = (s + 1) % segs
        if prev is None: bm.faces.new((center, cur[s], cur[s2]))
        else:
            bm.faces.new((prev[s], cur[s], cur[s2])); bm.faces.new((prev[s], cur[s2], prev[s2]))
    prev = cur
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
from_bm("Ice", bm, M["ice"])

# snow patches drifted onto the ice
for _ in range(7):
    a = random.uniform(0, 6.28); t = random.uniform(0.2, 0.8)
    blob("IceSnow", (px + math.cos(a) * rx * t, py + math.sin(a) * ry * t, ICE_Z),
         (random.uniform(.15, .4), random.uniform(.1, .3), 0.025), M["snow"], subdiv=1, jit=0.25)

# ---------------------------------------------------------------- house

def spill_light(parent, w, h, power, y=-0.22):
    ld = bpy.data.lights.new("Spill", "AREA")
    ld.shape = "RECTANGLE"; ld.size = w * 1.1; ld.size_y = h * 1.1
    ld.energy = power; ld.color = (1.0, 0.62, 0.32)
    ob = bpy.data.objects.new("Spill", ld)
    ob.location = (0, y, 0); ob.rotation_euler = (math.radians(-90), 0, 0)
    ob.visible_camera = False
    return link(ob, parent)

def window(parent, w, h, mullions=True, curtains=True, sill=True, shutters=False, power=None):
    f, d = 0.055, 0.07
    if shutters:
        for x in (w / 2 + f + 0.085, -w / 2 - f - 0.085):
            box("Shutter", (x, -0.02, 0), (0.15, 0.03, h + 0.06), M["shutter"], parent, bev=0.006, jit=0.004)
    no_shadow(box("Glass", (0, 0, 0), (w, 0.02, h), M["glass"], parent, bev=0))
    for z in (h / 2 + f / 2, -h / 2 - f / 2):
        box("Frame", (0, -0.02, z), (w + 2 * f, d, f), M["trim"], parent, bev=0.008)
    for x in (w / 2 + f / 2, -w / 2 - f / 2):
        box("Frame", (x, -0.02, 0), (f, d, h), M["trim"], parent, bev=0.008)
    if mullions:
        box("Mullion", (0, -0.02, 0), (0.028, d * 0.7, h), M["trim"], parent, bev=0)
        box("Mullion", (0, -0.02, 0), (w, d * 0.7, 0.028), M["trim"], parent, bev=0)
    if curtains:
        for s in (1, -1):
            no_shadow(box("Curtain", (s * w * 0.4, -0.014, 0.02), (w * 0.2, 0.01, h * 0.96),
                          M["curtain"], parent, bev=0))
    if sill:
        sz = -h / 2 - f - 0.02
        box("Sill", (0, -0.07, sz), (w + 2 * f + 0.08, 0.15, 0.045), M["trim"], parent, bev=0.01)
        box("SillSnow", (0, -0.075, sz + 0.04), (w + 2 * f + 0.05, 0.13, 0.06), M["snow"], parent,
            bev=0.025, segs=3, jit=0.01)
    spill_light(parent, w, h, power if power else (45 if DUSK else 10))

def snow_blanket(name, parent, rp, dv, nv, base, t0, t1, Ly, t, seed):
    """Roof snow as a lumpy blanket: uneven thickness, wavy gable edges, and a soft lip that curls
    over the eave. Built on a grid in roof space (u down the slope, y along the ridge)."""
    nu, ny = 13, 20  # fine enough to shade smoothly
    def n(a, b): return noise.noise(Vector((a * 1.6 + seed, b * 1.6, seed * 1.7)))
    bm = bmesh.new(); top, bot = {}, {}
    for i in range(nu + 1):
        for j in range(ny + 1):
            u, y = lerp(t0, t1, i / nu), lerp(-Ly / 2, Ly / 2, j / ny)
            if j in (0, ny): y += 0.05 * n(u, y + 9)
            eave = i == nu
            if eave: u += 0.02 + 0.04 * (n(u + 5, y) + 1)
            edge = min(Ly / 2 - abs(y), t1 - u if not eave else 0.0)
            thick = t * max(0.35, 0.9 + 0.8 * n(u, y)) * lerp(0.4, 1.0, smooth(edge / 0.15))
            p = rp + dv * u
            droop = 0.035 * (1.2 + n(u, y + 3)) if eave else 0.0  # the lip sags over the edge
            lift = base - (0.02 if eave else 0.0)
            tp, bp = p + nv * (base + thick), p + nv * lift
            top[i, j] = bm.verts.new((tp.x, y, tp.y - droop))
            bot[i, j] = bm.verts.new((bp.x, y, bp.y - droop * 0.6))
    for i in range(nu):
        for j in range(ny):
            bm.faces.new((top[i, j], top[i + 1, j], top[i + 1, j + 1], top[i, j + 1]))
            bm.faces.new((bot[i, j + 1], bot[i + 1, j + 1], bot[i + 1, j], bot[i, j]))
    ring = [(i, 0) for i in range(nu)] + [(nu, j) for j in range(ny)] + \
           [(i, ny) for i in range(nu, 0, -1)] + [(0, j) for j in range(ny, 0, -1)]
    for k in range(len(ring)):
        a, b = ring[k], ring[(k + 1) % len(ring)]
        bm.faces.new((top[a], bot[a], bot[b], top[b]))
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return soft(from_bm(name, bm, M["snow_roof"], parent=parent))

def bush(parent, x, y, s):
    """A low evergreen shrub: a few faceted lumps with snow settled on top."""
    for k in range(3):
        a = k * 2.1 + random.uniform(-.4, .4)
        r = s * random.uniform(0.17, 0.24)
        blob("Bush", (x + math.cos(a) * s * 0.13, y + math.sin(a) * s * 0.13, r * 0.85), (r, r, r * 0.95),
             M["bush"], jit=0.22, parent=parent)
    for k in range(2):  # small drifts caught on top, leaving the green showing
        a = k * 3.1 + random.uniform(-.5, .5)
        blob("BushSnow", (x + math.cos(a) * s * 0.07, y + math.sin(a) * s * 0.07, s * (0.37 - 0.05 * k)),
             (s * 0.13, s * 0.11, s * 0.05), M["snow_roof"], jit=0.25, parent=parent)

FACES = {"front": 0.0, "right": math.pi / 2, "back": math.pi, "left": -math.pi / 2}

def house(name, loc, W, D, Hw, rise, wall_m, windows=(), door=None, chimney=None, bushes=(), rz=0.0,
          porch=False, leanto=False, stovepipe=None):
    root = empty(name, loc, rz)
    base = 0.22
    box("Foundation", (0, 0, base / 2), (W + 0.12, D + 0.12, base), M["stone"], root, bev=0.02, jit=0.01)
    top, ridge = base + Hw, base + Hw + rise
    prof = [(-W / 2, base), (W / 2, base), (W / 2, top), (0, ridge), (-W / 2, top)]
    bm = bmesh.new()
    fr = [bm.verts.new((x, -D / 2, z)) for x, z in prof]
    bk = [bm.verts.new((x, D / 2, z)) for x, z in prof]
    bm.faces.new(fr); bm.faces.new(list(reversed(bk)))
    for k in range(5):
        k2 = (k + 1) % 5
        bm.faces.new((fr[k], fr[k2], bk[k2], bk[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    jitter(bm, 0.012)  # nothing hand-built is perfectly square
    from_bm("Walls", bm, wall_m, parent=root)

    # white corner boards, a Scandinavian signature
    for sx in (1, -1):
        for sy in (1, -1):
            box("Corner", (sx * W / 2, sy * D / 2, base + Hw / 2), (0.1, 0.1, Hw), M["trim"], root, bev=0.01,
                rot=(random.uniform(-.012, .012), random.uniform(-.012, .012), 0), jit=0.006)

    a = math.atan2(rise, W / 2)
    over, gover, tR, tS = 0.28, 0.2, 0.06, 0.07
    L = math.hypot(W / 2, rise) + over
    Ly = D + 2 * gover
    rp = Vector((0, ridge))
    # A thin dark board under a lumpy blanket of snow. Both run past the ridge far enough for the two
    # sides to meet in a peak.
    for s in (1, -1):
        dv = Vector((s * math.cos(a), -math.sin(a)))
        nv = Vector((s * math.sin(a), math.cos(a)))
        t0, t1 = -tR * math.tan(a), L
        c = rp + dv * ((t0 + t1) / 2) + nv * (tR / 2)
        box("Roof", (c.x, 0, c.y), (t1 - t0, Ly, tR), M["roof"], root, rot=(0, s * a, 0), bev=0.006, segs=1)
        snow_blanket("RoofSnow", root, rp, dv, nv, tR, -(tR + 0.1) * math.tan(a), L - 0.05, Ly - 0.04,
                     0.1, seed=3.0 + s * 7.0)

    for face, u, z, w, h, kw in windows:
        dist = D / 2 if face in ("front", "back") else W / 2
        r = FACES[face]
        g = empty("Win", (math.sin(r) * dist + math.cos(r) * u, -math.cos(r) * dist + math.sin(r) * u, z),
                  r, root)
        g.rotation_euler.y = random.uniform(-0.02, 0.02)  # frames set by hand, slightly off level
        window(g, w, h, **kw)

    if door:
        u, w, h = door
        g = empty("Door", (u, -D / 2, base), 0.0, root)
        box("DoorPanel", (0, -0.01, h / 2), (w, 0.05, h), M["door"], g, bev=0.008)
        f = 0.06
        box("DoorFrame", (0, -0.03, h + f / 2), (w + 2 * f, 0.07, f), M["trim"], g, bev=0.008)
        for x in (w / 2 + f / 2, -w / 2 - f / 2):
            box("DoorFrame", (x, -0.03, h / 2), (f, 0.07, h), M["trim"], g, bev=0.008)
        wg = empty("DoorWin", (0, -0.015, h * 0.75), 0.0, g)
        window(wg, w * 0.5, h * 0.22, mullions=False, curtains=False, sill=False, power=8 if DUSK else 3)
        box("Knob", (w * 0.33, -0.05, h * 0.45), (0.035, 0.03, 0.035), M["brass"], g, bev=0.008)
        # wreath
        bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.035, major_segments=10,
                                         minor_segments=5, location=(0, 0, 0))
        wr = bpy.context.active_object; wr.data.materials.append(M["wreath"])
        wr.parent = g; wr.location = (0, -0.06, h * 0.45); wr.rotation_euler = (math.pi / 2, 0, 0)
        box("Bow", (0, -0.085, h * 0.45 - 0.1), (0.07, 0.02, 0.04), M["red"], g, bev=0.008)
        box("Step", (0, -0.25, -0.1), (w + 0.35, 0.4, 0.2), M["stone"], g, bev=0.02, jit=0.01)
        box("StepSnow", (0.08, -0.32, 0.01), (w * 0.6, 0.22, 0.05), M["snow"], g, bev=0.02, jit=0.01)
        # wall lantern beside the door
        lg = empty("Lantern", (w / 2 + 0.2, -0.08, h * 0.78), 0.0, g)
        box("LanternTop", (0, 0, 0.11), (0.12, 0.12, 0.03), M["iron"], lg, bev=0.005)
        no_shadow(box("LanternGlass", (0, 0, 0), (0.09, 0.09, 0.17), M["lamp"], lg, bev=0))
        box("LanternBase", (0, 0, -0.1), (0.1, 0.1, 0.025), M["iron"], lg, bev=0.005)
        add_point(lg, (0, -0.1, 0), 12 if DUSK else 3)

    if chimney:
        cx, cy = chimney
        roof_z = ridge - abs(cx) * math.tan(a)
        h0, h1 = roof_z - 0.1, ridge + 0.5
        lean = (random.uniform(-.03, .03), random.uniform(-.03, .03), 0.05)
        box("Chimney", (cx, cy, (h0 + h1) / 2), (0.3, 0.3, h1 - h0), M["brick"], root, rot=lean, bev=0.012, jit=0.01)
        box("ChimneyCap", (cx, cy, h1 + 0.02), (0.37, 0.37, 0.06), M["stone"], root, rot=lean, bev=0.01, jit=0.012)
        soft(blob("ChimneySnow", (cx, cy, h1 + 0.07), (0.2, 0.2, 0.06), M["snow_roof"], jit=0.15, parent=root, rz=0.05))
        for k in range(4):
            t = k / 3
            blob("Smoke", (cx + 0.15 * k + 0.05, cy - 0.05 * k, h1 + 0.35 + 0.42 * k),
                 (0.08 + 0.05 * k,) * 3, M["smoke"], jit=0.2, parent=root)

    if porch and door:
        # A small porch roof on two posts over the front door.
        u, w, h = door
        pw, pd, top = w + 0.55, 0.62, base + h + 0.32
        for x in (u - pw / 2 + 0.05, u + pw / 2 - 0.05):
            box("PorchPost", (x, -D / 2 - pd + 0.06, (base + top) / 2 - 0.05), (0.07, 0.07, top - base - 0.1),
                M["trim"], root, rot=(0, random.uniform(-.02, .02), 0), bev=0.008, jit=0.004)
        tilt = 0.32
        box("PorchRoof", (u, -D / 2 - pd / 2, top), (pw + 0.1, pd + 0.12, 0.05), M["roof"], root,
            rot=(tilt, 0, 0), bev=0.006)
        soft(box("PorchSnow", (u, -D / 2 - pd / 2 - 0.01, top + 0.06), (pw + 0.06, pd + 0.08, 0.08), M["snow_roof"], root,
            rot=(tilt, 0, 0), bev=0.03, segs=2, jit=0.02))
        box("PorchStep", (u, -D / 2 - pd / 2, 0.06), (pw, pd, 0.12), M["stone"], root, bev=0.015, jit=0.01)

    if leanto:
        # A woodshed lean-to against the right wall, with a single-slope roof.
        lw, ld, lh = 0.8, 1.2, Hw * 0.75
        cx, cy = W / 2 + lw / 2, 0.15
        box("LeanWalls", (cx, cy, base + lh / 2 - 0.02), (lw, ld, lh), wall_m, root, bev=0.01, jit=0.01)
        box("LeanBase", (cx, cy, base / 2), (lw + 0.06, ld + 0.06, base), M["stone"], root, bev=0.015, jit=0.01)
        slope = math.atan2(0.35, lw)
        rz_ = base + lh + 0.17
        box("LeanRoof", (cx + 0.05, cy, rz_), (lw + 0.3, ld + 0.25, 0.05), M["roof"], root, rot=(0, slope, 0), bev=0.006)
        soft(box("LeanSnow", (cx + 0.05, cy, rz_ + 0.06), (lw + 0.26, ld + 0.2, 0.08), M["snow_roof"], root,
            rot=(0, slope, 0), bev=0.03, segs=2, jit=0.02))
        g = empty("Win", (cx, cy - ld / 2, base + lh * 0.55), 0.0, root)
        window(g, 0.3, 0.26, curtains=False)

    if stovepipe:
        # A thin iron stovepipe instead of a chimney.
        px, py = stovepipe
        roof_z = ridge - abs(px) * math.tan(a)
        cone("Stovepipe", (px, py, roof_z + 0.3), 0.06, 0.06, 0.75, M["iron"], segs=8, parent=root)
        cone("StoveCap", (px, py, roof_z + 0.72), 0.12, 0.02, 0.1, M["iron"], segs=8, parent=root)
        soft(blob("StoveSnow", (px, py, roof_z + 0.78), (0.09, 0.09, 0.03), M["snow_roof"], jit=0.2, parent=root))

    for x, y, sz in bushes:
        bush(root, x, y, sz)
    return root

def add_point(parent, loc, power):
    ld = bpy.data.lights.new("Glow", "POINT")
    ld.energy = power; ld.color = (1.0, 0.66, 0.36); ld.shadow_soft_size = 0.06
    ob = bpy.data.objects.new("Glow", ld); ob.location = loc
    return link(ob, parent)

# House designs for the planet. Each is a recipe for house(); the web export bakes all of them into one
# shared texture and the browser colours their walls per house.
B0 = 0.22  # foundation height
DESIGNS = {
    # The red cottage: gable to the front, door and window below, attic window above.
    "Cottage": dict(W=2.0, D=2.6, Hw=1.25, rise=1.15, color=(0.42, 0.055, 0.035),
        windows=[("front", 0.45, B0 + 0.78, 0.48, 0.58, {}), ("front", 0.0, 2.05, 0.3, 0.36, {"curtains": False}),
                 ("right", -0.6, B0 + 0.72, 0.5, 0.6, {}), ("right", 0.6, B0 + 0.72, 0.5, 0.6, {})],
        door=(-0.45, 0.5, 0.92), chimney=(0.5, 0.55),
        bushes=[(0.3, -1.52, 1.0), (0.78, -1.48, 0.75), (-0.98, -1.47, 0.85), (1.22, 0.02, 0.95),
                (1.2, 1.08, 0.7), (-1.17, 1.45, 0.8)]),
    # Tall and narrow, two storeys, shuttered windows.
    "Townhouse": dict(W=1.7, D=2.1, Hw=2.15, rise=1.0, color=(0.72, 0.45, 0.12),
        windows=[("front", 0.42, B0 + 0.78, 0.36, 0.5, {}),
                 ("front", -0.42, B0 + 1.7, 0.38, 0.52, {"shutters": True}),
                 ("front", 0.42, B0 + 1.7, 0.38, 0.52, {"shutters": True}),
                 ("front", 0.0, B0 + 2.65, 0.26, 0.3, {"curtains": False}),
                 ("right", -0.4, B0 + 0.75, 0.4, 0.5, {}), ("right", 0.4, B0 + 1.7, 0.4, 0.5, {})],
        door=(-0.36, 0.44, 0.95), chimney=(-0.4, 0.45),
        bushes=[(-0.55, -1.2, 0.7), (0.55, -1.2, 0.7), (1.0, 0.75, 0.75)]),
    # Long and low with a shallow roof and a porch over the door.
    "Cabin": dict(W=2.5, D=3.0, Hw=0.95, rise=0.62, color=(0.30, 0.42, 0.50),
        windows=[("front", -0.6, B0 + 0.55, 0.5, 0.42, {}),
                 ("right", -0.95, B0 + 0.55, 0.42, 0.42, {}), ("right", 0.0, B0 + 0.55, 0.42, 0.42, {}),
                 ("right", 0.95, B0 + 0.55, 0.42, 0.42, {})],
        door=(0.5, 0.48, 0.85), chimney=(-0.7, 0.9), porch=True,
        bushes=[(-1.3, -1.65, 0.8), (1.45, -0.6, 0.8), (1.45, 1.3, 0.65)]),
    # Small and steep, almost an A-frame, with a lean-to woodshed and a stovepipe.
    "Aframe": dict(W=1.6, D=2.0, Hw=0.7, rise=1.55, color=(0.33, 0.43, 0.28),
        windows=[("front", 0.0, B0 + 1.35, 0.4, 0.46, {})],
        door=(0.0, 0.46, 0.85), leanto=True, stovepipe=(-0.38, 0.35),
        bushes=[(-0.75, -1.2, 0.75), (0.55, -1.25, 0.6)]),
}

def build_design(key, loc, wall_m=None):
    d = dict(DESIGNS[key]); color = d.pop("color")
    return house(key, loc, wall_m=wall_m or wood_mat(f"Wall{key}", color), **d)

hx, hy, _, _, hz = FLAT[0]
house("House", (hx, hy, hz), W=2.0, D=2.6, Hw=1.25, rise=1.15, wall_m=M["falu"],
      windows=[("front", 0.45, 0.22 + 0.78, 0.48, 0.58, {}),
               ("front", 0.0, 2.05, 0.3, 0.36, {"curtains": False}),
               ("right", -0.6, 0.22 + 0.72, 0.5, 0.6, {}),
               ("right", 0.6, 0.22 + 0.72, 0.5, 0.6, {})],
      door=(-0.45, 0.5, 0.92), chimney=(0.5, 0.55),
      bushes=[(0.3, -1.52, 1.0), (0.78, -1.48, 0.75), (-0.98, -1.47, 0.85), (1.22, 0.02, 0.95),
              (1.2, 1.08, 0.7), (-1.17, 1.45, 0.8)])

sx_, sy_, _, _, sz_ = FLAT[1]
house("Shed", (sx_, sy_, sz_), W=1.3, D=1.5, Hw=0.85, rise=0.8, wall_m=M["ochre"],
      windows=[("front", 0.0, 0.22 + 0.5, 0.36, 0.4, {"power": 22 if DUSK else 7}),
               ("right", 0.0, 0.22 + 0.5, 0.36, 0.4, {"power": 22 if DUSK else 7})])

# ---------------------------------------------------------------- props

def pine(x, y, s, tiers=4):
    root = empty("Pine", (x, y, H(x, y) - 0.06), random.uniform(0, 6.28))
    cone("Trunk", (0, 0, 0.22 * s), 0.09 * s, 0.07 * s, 0.44 * s, M["bark"], segs=6, parent=root)
    for i in range(tiers):
        t = i / (tiers - 1)
        r, h = lerp(0.78, 0.3, t) * s, lerp(0.95, 0.62, t) * s
        zb = (0.32 + i * 0.5) * s
        cone("Needles", (0, 0, zb + h / 2), r, 0.0, h, M["pine"], segs=7, parent=root, jit=0.035 * s)
        k = 0.6
        cone("TierSnow", (0, 0, zb + h - k * h / 2 + 0.012 * s), r * k * 1.1, 0.0, k * h,
             M["snow_roof"], segs=7, parent=root, jit=0.025 * s)
        # a little snow skirt sitting on each tier's rim
        cone("RimSnow", (0, 0, zb + 0.06 * s), r * 1.02, r * 0.86, 0.1 * s, M["snow_roof"],
             segs=7, parent=root, jit=0.02 * s)
    blob("TreeDrift", (0, 0, 0.02), (0.55 * s, 0.55 * s, 0.14 * s), M["snow"], parent=root)

for x, y, s in [(-4.0, 3.7, 1.25), (-2.7, 4.3, 1.05), (-0.7, 4.25, 1.35), (0.9, 4.0, 0.95),
                (-4.25, 1.5, 0.85), (4.25, 4.25, 1.1), (4.3, 0.7, 0.95), (4.05, -0.55, 0.72),
                (-4.15, -3.75, 0.95), (-3.1, -4.25, 0.68), (-3.45, 2.7, 0.7), (3.4, 4.4, 0.75)]:
    pine(x, y, s)

def rock(x, y, s, snowy=True):
    z = H(x, y)
    blob("Rock", (x, y, z), (s, s * 0.8, s * 0.55), M["rock"], jit=0.22)
    if snowy:
        blob("RockSnow", (x, y, z + s * 0.32), (s * 0.85, s * 0.68, s * 0.28), M["snow"], jit=0.15)

for x, y, s in [(4.1, -2.5, 0.38), (4.3, -3.5, 0.25), (0.25, -3.85, 0.3), (-0.05, -1.15, 0.2),
                (3.3, 0.9, 0.3), (-2.9, 2.55, 0.24), (0.9, -0.6, 0.16), (-4.4, -2.5, 0.3)]:
    rock(x, y, s)

# stepping stones along the path
for i in range(len(PATH) - 1):
    (ax, ay), (bx, by) = PATH[i], PATH[i + 1]
    n = max(1, int(math.hypot(bx - ax, by - ay) / 0.38))
    for k in range(n):
        t = (k + 0.5) / n
        x, y = lerp(ax, bx, t) + random.uniform(-.05, .05), lerp(ay, by, t) + random.uniform(-.05, .05)
        cone("Stone", (x, y, H(x, y) + 0.005), random.uniform(.11, .15), random.uniform(.1, .13), 0.05,
             M["stone"], segs=6, rot=(0, 0, random.uniform(0, 6)), jit=0.015)

# lamp post by the path
lx, ly = -0.55, -1.35
lz = H(lx, ly)
lp = empty("LampPost", (lx, ly, lz))
cone("Post", (0, 0, 0.75), 0.035, 0.025, 1.5, M["iron"], segs=6, parent=lp)
cone("PostBase", (0, 0, 0.06), 0.08, 0.06, 0.12, M["iron"], segs=6, parent=lp)
box("LampCap", (0, 0, 1.72), (0.2, 0.2, 0.04), M["iron"], lp, bev=0.008)
cone("LampRoof", (0, 0, 1.79), 0.15, 0.0, 0.1, M["iron"], segs=4, parent=lp, rot=(0, 0, math.pi / 4))
cone("LampSnow", (0, 0, 1.81), 0.12, 0.0, 0.08, M["snow_roof"], segs=4, parent=lp, rot=(0, 0, math.pi / 4))
no_shadow(box("LampGlass", (0, 0, 1.6), (0.15, 0.15, 0.2), M["lamp"], lp, bev=0))
box("LampFloor", (0, 0, 1.49), (0.18, 0.18, 0.03), M["iron"], lp, bev=0.006)
add_point(lp, (0, 0, 1.6), 45 if DUSK else 8)

# fence around the front garden
def fence(a, b, step=0.34):
    (ax, ay), (bx, by) = a, b
    ln = math.hypot(bx - ax, by - ay); ang = math.atan2(by - ay, bx - ax)
    n = int(ln / step)
    for k in range(n + 1):
        t = k / n; x, y = lerp(ax, bx, t), lerp(ay, by, t)
        z = H(x, y)
        box("Post", (x, y, z + 0.22), (0.06, 0.06, 0.5), M["fence"], rot=(0, 0, ang + random.uniform(-.06, .06)),
            bev=0.008, jit=0.006)
        blob("PostSnow", (x, y, z + 0.48), (0.055, 0.055, 0.035), M["snow_roof"], jit=0.1)
    mx, my = (ax + bx) / 2, (ay + by) / 2
    mz = H(mx, my)
    for zz in (0.17, 0.36):
        box("Rail", (mx, my, mz + zz), (ln, 0.03, 0.05), M["fence"], rot=(0, 0, ang), bev=0.006)
    box("RailSnow", (mx, my, mz + 0.405), (ln, 0.045, 0.03), M["snow_roof"], rot=(0, 0, ang), bev=0.012)

fence((-4.6, -1.55), (-2.3, -1.55))
fence((-4.6, -1.55), (-4.6, 0.2))

# woodpile against the house's right-front corner
wp = empty("Woodpile", (hx + 1.22, hy - 1.15, hz), 0.0)
for row, cnt in enumerate((4, 3, 2)):
    for k in range(cnt):
        x = (k - (cnt - 1) / 2) * 0.15
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=7, radius1=0.07, radius2=0.07, depth=0.55)
        for f in bm.faces:
            if abs(f.normal.z) > 0.9: f.material_index = 1
        jitter(bm, 0.008)
        from_bm("Log", bm, [M["bark"], M["logend"]], (0, x, 0.07 + row * 0.125),
                (0, math.pi / 2, random.uniform(0, 1)), wp)
blob("PileSnow", (0, 0, 0.36), (0.3, 0.24, 0.06), M["snow_roof"], jit=0.12, parent=wp, rz=0)

# red sled resting by the pond
sl = empty("Sled", (0.15, -3.0, H(0.15, -3.0) + 0.02), math.radians(-28))
for sy in (0.13, -0.13):
    box("Runner", (0, sy, 0.03), (0.75, 0.025, 0.03), M["iron"], sl, bev=0.006)
    for x in (-0.25, 0.0, 0.25):
        box("Strut", (x, sy, 0.08), (0.03, 0.025, 0.1), M["red"], sl, bev=0.005)
    box("Curl", (0.39, sy, 0.08), (0.03, 0.025, 0.12), M["iron"], sl, rot=(0, -0.5, 0), bev=0.005)
for x in (-0.24, -0.08, 0.08, 0.24):
    box("Slat", (x, 0, 0.14), (0.11, 0.36, 0.025), M["red"], sl, bev=0.006)

# drifts against the house walls and scattered snow lumps
for k in range(9):
    t = k / 8
    blob("Drift", (hx + lerp(-1.0, 1.0, t), hy + 1.38, hz + 0.05), (0.32, 0.22, 0.14), M["snow"], jit=0.15)
    blob("Drift", (hx + 1.08, hy + lerp(-1.2, 1.3, t), hz + 0.04), (0.18, 0.3, 0.13), M["snow"], jit=0.15)
for _ in range(26):
    x, y = random.uniform(-4.6, 4.6), random.uniform(-4.6, 4.6)
    if math.hypot((x - POND[0]) / POND[2], (y - POND[1]) / POND[3]) < 1.15: continue
    if abs(x - hx) < 1.3 and abs(y - hy) < 1.6: continue
    r = random.uniform(0.15, 0.4)
    blob("Lump", (x, y, H(x, y) - 0.02), (r, r * random.uniform(.6, 1), r * 0.35), M["snow"], jit=0.15)

# falling snow, kept above the tile like the reference
flake = bpy.data.meshes.new("Flake")
bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.028); bm.to_mesh(flake); bm.free()
flake.materials.append(mat("Flake", (0.97, 0.97, 1.0), rough=0.8, emit=(0.8, 0.85, 1.0), strength=0.4 if DUSK else 0.1))
for _ in range(320):
    ob = bpy.data.objects.new("Flake", flake)
    ob.location = (random.uniform(-S, S), random.uniform(-S, S), random.uniform(0.4, 6.0))
    ob.visible_shadow = False
    link(ob)

# ---------------------------------------------------------------- light, world, camera

sun_d = bpy.data.lights.new("Sun", "SUN")
if DUSK:
    sun_d.energy = 0.35; sun_d.color = (0.62, 0.72, 1.0); sun_d.angle = math.radians(4)
    sun_rot = (math.radians(55), 0, math.radians(150))
else:
    sun_d.energy = 4.5; sun_d.color = (1.0, 0.74, 0.48); sun_d.angle = math.radians(2.5)
    sun_rot = (math.radians(64), 0, math.radians(-32))
sun = link(bpy.data.objects.new("Sun", sun_d)); sun.rotation_euler = sun_rot

world = bpy.data.worlds.new("World"); scene.world = world
try: world.use_nodes = True
except Exception: pass
N, L = world.node_tree.nodes, world.node_tree.links
sky = N["Background"]
cam_bg = N.new("ShaderNodeBackground"); lpath = N.new("ShaderNodeLightPath"); mix = N.new("ShaderNodeMixShader")
if DUSK:
    sky.inputs["Color"].default_value = (0.20, 0.30, 0.58, 1); sky.inputs["Strength"].default_value = 0.55
    cam_bg.inputs["Color"].default_value = (0.055, 0.075, 0.13, 1)
else:
    sky.inputs["Color"].default_value = (0.50, 0.64, 0.95, 1); sky.inputs["Strength"].default_value = 0.38
    cam_bg.inputs["Color"].default_value = (0.66, 0.67, 0.69, 1)
cam_bg.inputs["Strength"].default_value = 1.0
L.new(lpath.outputs["Is Camera Ray"], mix.inputs[0])
L.new(sky.outputs[0], mix.inputs[1]); L.new(cam_bg.outputs[0], mix.inputs[2])
L.new(mix.outputs[0], N["World Output"].inputs["Surface"])

cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = 15.5
cam = link(bpy.data.objects.new("Cam", cam_d))
cam.rotation_euler = (math.radians(60), 0, math.radians(45))
look = Vector((0, 0, -1)); look.rotate(cam.rotation_euler)
target = Vector((FLAT[0][0], FLAT[0][1], 1.3)) if args.closeup else Vector((0, 0, 0.4))
if args.closeup: cam_d.ortho_scale = 5.2
cam.location = target - look * 40
cam_d.clip_end = 100
scene.camera = cam

r = scene.render
r.engine = "CYCLES"
r.resolution_x, r.resolution_y = args.res
r.resolution_percentage = 100
r.filepath = os.path.join(HERE, args.out)
r.image_settings.file_format = "PNG"
c = scene.cycles
c.samples = args.samples; c.use_denoising = True
c.max_bounces = 8; c.transmission_bounces = 6; c.caustics_reflective = False; c.caustics_refractive = False
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    c.device = "GPU"
except Exception as e:
    print("GPU setup failed, using CPU:", e)

vs = scene.view_settings
vs.view_transform = "AgX"
for look_name in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try: vs.look = look_name; break
    except Exception: pass
vs.exposure = 0.0 if DUSK else -0.2

# ---------------------------------------------------------------- web export

# Materials that stay live in the browser as emissive colour; everything else is baked into one texture.
GLOW_MATS = {"WindowGlow": ("Glow", WARM, 2.4), "LampGlow": ("Glow", WARM, 2.4),
             "Curtain": ("GlowSoft", (1.0, 0.72, 0.42), 1.1)}
SKIP = ("Smoke",)  # static smoke puffs read as rocks in a live scene

def descendants(ob):
    out = [ob]
    for c in ob.children: out += descendants(c)
    return out

def join(name, objs):
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs):
        bpy.ops.object.join()
    objs[0].name = objs[0].data.name = name
    return objs[0]

def plain_mat(name, color, emit=None, strength=0.0, image=None):
    m, N, L, b = node_mat(name)
    b.inputs["Roughness"].default_value = 0.85
    b.inputs["Base Color"].default_value = (*color, 1)
    if image:
        tex = N.new("ShaderNodeTexImage"); tex.image = image
        L.new(tex.outputs["Color"], b.inputs["Base Color"])
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m

def bake_into(obj, kind, size, samples):
    img = bpy.data.images.new(f"bake_{kind}", size, size, float_buffer=True)
    for m in obj.data.materials:
        tex = m.node_tree.nodes.new("ShaderNodeTexImage"); tex.image = img
        m.node_tree.nodes.active = tex
    scene.cycles.samples = samples
    with bpy.context.temp_override(active_object=obj, selected_objects=[obj]):
        if kind == "DIFFUSE":
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=6)
        else:
            bpy.ops.object.bake(type="AO", margin=6)
    import numpy as np
    px = np.empty(size * size * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return px.reshape(-1, 4)

def mesh_copy(ob, dg, offset):
    """The object's mesh with modifiers applied, in its design's own space."""
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    me.transform(ob.matrix_world)
    me.transform(Matrix.Translation(-offset))
    return me

def export_designs(path):
    """Every design in one GLB. Per design: <Key>_Body (baked colour + AO), <Key>_Walls (same texture,
    baked near-white so the browser can tint it), <Key>_Glow (two emissive materials) and Halo_<Key>
    empties on each pane. All bodies and walls share one texture atlas."""
    import numpy as np
    for ob in list(scene.objects): bpy.data.objects.remove(ob)
    keys = list(DESIGNS)
    offsets = {k: Vector((i * 8.0, 0, 0)) for i, k in enumerate(keys)}
    roots = {k: build_design(k, offsets[k], wall_m=M["wall_neutral"]) for k in keys}
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()

    parts, glows, halos = [], {k: [] for k in keys}, []
    for k in keys:
        for ob in descendants(roots[k]):
            if ob.type != "MESH" or ob.name.startswith(SKIP): continue
            if ob.name.startswith(("Glass", "LanternGlass")):
                h = bpy.data.objects.new(f"Halo_{k}", None)
                h.matrix_world = Matrix.Translation(-offsets[k]) @ ob.matrix_world
                h.scale = (ob.dimensions.x, 1.0, ob.dimensions.z)
                halos.append(link(h))
            me = mesh_copy(ob, dg, Vector((0, 0, 0)))  # keep the offset while baking so designs don't touch
            copy = link(bpy.data.objects.new(ob.name, me))
            if me.materials[0].name in GLOW_MATS:
                glows[k].append(copy); continue
            # Tag every face with its design and whether it's a tintable wall, to split after baking.
            base_name = ob.name.split(".")[0]  # Blender suffixes repeated names: Walls.001
            tag = keys.index(k) * 2 + (1 if base_name in ("Walls", "LeanWalls") else 0)
            attr = me.attributes.new("part", "INT", "FACE")
            attr.data.foreach_set("value", [tag] * len(me.polygons))
            parts.append(copy)
    keep = set(parts) | set(halos) | {o for g in glows.values() for o in g}
    for ob in list(scene.objects):
        if ob not in keep: bpy.data.objects.remove(ob)

    atlas = join("Atlas", parts)
    bpy.context.view_layer.objects.active = atlas
    atlas.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
    bpy.ops.object.mode_set(mode="OBJECT")

    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
    ground = from_bm("BakeGround", bm, M["snow"])
    size = args.bake_size
    albedo = bake_into(atlas, "DIFFUSE", size, 1)
    ao = bake_into(atlas, "AO", size, 128)
    bpy.data.objects.remove(ground)
    shade = 0.3 + 0.7 * ao[:, :1]
    lin = np.clip(albedo[:, :3] * shade, 0, 1)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    img = bpy.data.images.new("HouseAtlas", size, size)
    img.pixels.foreach_set(np.concatenate([srgb, np.ones((size * size, 1))], axis=1).astype(np.float32).ravel())
    img.file_format = "JPEG"
    img.filepath_raw = os.path.join(HERE, "renders", "house_atlas.jpg"); img.save()
    body_mat = plain_mat("HouseBody", (1, 1, 1), image=img)
    wall_mat = plain_mat("HouseWalls", (1, 1, 1), image=img)

    # Split the baked atlas mesh back into one body and one wall object per design.
    tags = [0] * len(atlas.data.polygons)
    atlas.data.attributes["part"].data.foreach_get("value", tags)
    out = []
    for i, k in enumerate(keys):
        for wall in (0, 1):
            bm = bmesh.new(); bm.from_mesh(atlas.data)
            bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm, geom=[f for f, t in zip(bm.faces, tags) if t != i * 2 + wall], context="FACES")
            bmesh.ops.translate(bm, vec=-offsets[k], verts=bm.verts)
            name = f"{k}_{'Walls' if wall else 'Body'}"
            ob = from_bm(name, bm, wall_mat if wall else body_mat)
            for p in ob.data.polygons: p.material_index = 0
            out.append(ob)
    bpy.data.objects.remove(atlas)

    mats = {}
    for name, (new, color, strength) in GLOW_MATS.items():
        if new not in mats: mats[new] = plain_mat(new, (0, 0, 0), emit=color, strength=strength)
    order = list(mats)
    for k in keys:
        g = join(f"{k}_Glow", glows[k])
        g.data.transform(Matrix.Translation(-offsets[k]))
        old = [m.name for m in g.data.materials]
        g.data.materials.clear()
        for n in order: g.data.materials.append(mats[n])
        for p in g.data.polygons:
            p.material_index = order.index(GLOW_MATS[old[p.material_index]][0])
        out.append(g)

    for o in out:
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        print(f"EXPORT {o.name}: {tris} triangles")
    print(f"EXPORT total={sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in out)} halos={len(halos)}")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True,
                              export_image_format="WEBP", export_image_quality=82,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_yup=True, export_lights=False, export_cameras=False)

def lineup():
    """Every design side by side on open snow, each in its default wall colour."""
    keys = list(DESIGNS)
    for i, k in enumerate(keys):
        build_design(k, Vector(((i - (len(keys) - 1) / 2) * 4.2, 40.0, 0.0)))
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14)
    from_bm("LineupGround", bm, M["snow"], loc=(0, 40, 0.0))
    look = Vector((0, 0, -1)); look.rotate(cam.rotation_euler)
    cam.location = Vector((0.6, 40.0, 1.2)) - look * 40
    cam_d.ortho_scale = 17.5

if args.export:
    export_designs(os.path.abspath(args.export))
    sys.exit(0)
if args.lineup:
    lineup()

if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, args.blend))
bpy.ops.render.render(write_still=True)
print("WROTE", r.filepath)
