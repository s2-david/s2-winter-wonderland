"""Gingerbread Land: gingerbread houses, trees and candy fixtures for the sunny side of the planet.

Run headless (Blender 5.2):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P gingerbread.py -- \
      --scene diorama --samples 128 --res 1600 1200 --out renders/gingerbread_diorama.png

Scenes: "diorama" (a cluster of houses and trees, like the paper village reference), "lineup" (every
design and prop side by side) and "closeup" (one cottage, to judge the gingerbread texture).
`--export path.glb` writes every design and prop as one baked GLB for the web instead.
Everything is built from code, like winter_house.py, so the look can be tuned and reviewed in text.
"""
import bpy, bmesh, math, random, sys, os, argparse
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--scene", default="diorama", choices=["diorama", "lineup", "closeup"])
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--res", type=int, nargs=2, default=[1600, 1200])
ap.add_argument("--out", default="")
ap.add_argument("--blend", default="")
ap.add_argument("--export", default="", help="write every design and prop as one baked GLB for the web")
ap.add_argument("--bake-size", type=int, default=2048)
args = ap.parse_args(argv)
HERE = os.path.dirname(os.path.abspath(__file__))

random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- helpers (as in winter_house.py)

def lerp(a, b, t): return a + (b - a) * t

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

def soft(ob):
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def box(name, loc, size, mat, parent=None, rot=(0, 0, 0), bev=0.012, segs=2, jit=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if jit: jitter(bm, jit)
    ob = from_bm(name, bm, mat, loc, rot, parent)
    return bevel(ob, bev, segs) if bev else ob

def cone(name, loc, r1, r2, depth, mat, segs=8, parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r1, radius2=r2, depth=depth)
    return from_bm(name, bm, mat, loc, rot, parent)

def ball(name, loc, r, mat, parent=None, segs=(8, 5)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=r)
    return soft(from_bm(name, bm, mat, loc, parent=parent))

# ---------------------------------------------------------------- shader node helpers

def _in(L, sock, v):
    if isinstance(v, bpy.types.NodeSocket): L.new(v, sock)
    elif isinstance(v, (tuple, list)) and len(v) == 3 and len(sock.default_value) == 4: sock.default_value = (*v, 1)
    else: sock.default_value = v

def op(N, L, kind, a, b=0.0, c=0.0):
    n = N.new("ShaderNodeMath"); n.operation = kind
    for s, v in zip(n.inputs, (a, b, c)): _in(L, s, v)
    return n.outputs[0]

def vop(N, L, kind, a, b=(0, 0, 0)):
    n = N.new("ShaderNodeVectorMath"); n.operation = kind
    _in(L, n.inputs[0], a); _in(L, n.inputs[1], b)
    return n.outputs["Value"] if kind in ("DOT_PRODUCT", "LENGTH") else n.outputs["Vector"]

def remap(N, L, x, a, b, lo=0.0, hi=1.0, smooth=False):
    n = N.new("ShaderNodeMapRange")
    if smooth: n.interpolation_type = "SMOOTHSTEP"
    _in(L, n.inputs[0], x)
    for i, v in zip((1, 2, 3, 4), (a, b, lo, hi)): n.inputs[i].default_value = v
    return n.outputs[0]

def mix_rgb(N, L, fac, a, b):
    mx = N.new("ShaderNodeMix"); mx.data_type = "RGBA"
    _in(L, mx.inputs[0], fac); _in(L, mx.inputs[6], a); _in(L, mx.inputs[7], b)
    return mx.outputs[2]

def tex_noise(N, L, vec, scale, detail=4.0, rough=0.5):
    n = N.new("ShaderNodeTexNoise"); L.new(vec, n.inputs["Vector"])
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    return n.outputs["Fac"]

def obj_co(N): return N.new("ShaderNodeTexCoord").outputs["Object"]

def xyz(N, L, vec):
    sep = N.new("ShaderNodeSeparateXYZ"); L.new(vec, sep.inputs[0]); return sep.outputs

def combine(N, L, x, y, z=0.0):
    n = N.new("ShaderNodeCombineXYZ")
    for s, v in zip(n.inputs, (x, y, z)): _in(L, s, v)
    return n.outputs[0]

def add_bump(m, height, strength, distance=0.02):
    N, L = m.node_tree.nodes, m.node_tree.links
    bump = N.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    L.new(height, bump.inputs["Height"])
    L.new(bump.outputs["Normal"], N["Principled BSDF"].inputs["Normal"])

# ---------------------------------------------------------------- materials

def mat(name, color, rough=0.7, sss=0.0, coat=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (1.0, 0.6, 0.4)
        b.inputs["Subsurface Scale"].default_value = 0.03
    if coat: b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m

# Baked ginger dough, in linear colour: a warm golden brown with gentle oven variation, tiny air pores,
# and edges that baked darker and rounder. Kept clean on purpose: heavy mottling reads as dirty cardboard.
GB = (0.42, 0.15, 0.040)
GB_LIGHT = (0.62, 0.29, 0.085)
GB_EDGE = (0.26, 0.085, 0.020)
GB_DARK = (0.13, 0.040, 0.010)

def gingerbread_mat(name, base=GB, light=GB_LIGHT, edge_col=GB_EDGE, dark=GB_DARK):
    m = mat(name, base, rough=0.5)
    N, L = m.node_tree.nodes, m.node_tree.links
    co = obj_co(N)
    oven = tex_noise(N, L, co, 1.2, 2)              # where the oven ran hotter or cooler
    rise = tex_noise(N, L, co, 6, 3)                # soft unevenness of the risen dough
    crumb = tex_noise(N, L, co, 80, 6, 0.6)         # fine texture, felt more than seen
    pores = N.new("ShaderNodeTexVoronoi"); L.new(co, pores.inputs["Vector"])
    pores.inputs["Scale"].default_value = 55
    pore = remap(N, L, pores.outputs["Distance"], 0.03, 0.07, 1.0, 0.0, smooth=True)
    bubbles = N.new("ShaderNodeTexVoronoi"); L.new(co, bubbles.inputs["Vector"])
    bubbles.inputs["Scale"].default_value = 12
    bubble = remap(N, L, bubbles.outputs["Distance"], 0.025, 0.05, 1.0, 0.0, smooth=True)
    col = mix_rgb(N, L, remap(N, L, oven, 0.35, 0.65, 0.0, 0.7), base, light)
    col = mix_rgb(N, L, remap(N, L, rise, 0.4, 0.7, 0.0, 0.18), col, edge_col)
    col = mix_rgb(N, L, op(N, L, "MULTIPLY", op(N, L, "MAXIMUM", pore, bubble), 0.45), col, dark)
    # Baked edges: where a rounded (bevel) normal turns away from the flat face normal, the dough browned.
    bev = N.new("ShaderNodeBevel"); bev.inputs["Radius"].default_value = 0.06
    geo = N.new("ShaderNodeNewGeometry")
    edge = remap(N, L, vop(N, L, "DOT_PRODUCT", bev.outputs["Normal"], geo.outputs["True Normal"]), 0.995, 0.85, smooth=True)
    col = mix_rgb(N, L, op(N, L, "MULTIPLY", edge, 0.8), col, edge_col)
    L.new(col, N["Principled BSDF"].inputs["Base Color"])
    height = op(N, L, "MULTIPLY_ADD", rise, 0.5, op(N, L, "MULTIPLY_ADD", crumb, 0.12,
                op(N, L, "MULTIPLY", op(N, L, "MAXIMUM", pore, bubble), -0.6)))
    add_bump(m, height, 0.4, 0.012)
    return m

def icing_mat(name, color=(0.86, 0.84, 0.80)):
    m = mat(name, color, rough=0.42, sss=0.12)
    N, L = m.node_tree.nodes, m.node_tree.links
    add_bump(m, tex_noise(N, L, obj_co(N), 30, 4), 0.12, 0.01)
    return m

def frosting_mat(name, color, mode):
    """Thick roof icing laid in fish-scale shingles. `mode` says which way is downhill in object space:
    "+x" / "-x" for the two halves of a gable roof, "spire" for a pyramid (downhill is -z)."""
    m = mat(name, color, rough=0.45, sss=0.12)
    N, L = m.node_tree.nodes, m.node_tree.links
    x, y, z = xyz(N, L, obj_co(N))
    if mode == "spire":
        u, v = op(N, L, "MULTIPLY", z, -1.0), op(N, L, "ADD", x, y)
    else:
        u, v = op(N, L, "MULTIPLY", x, 1.0 if mode == "+x" else -1.0), y
    U, V = op(N, L, "MULTIPLY", u, 1 / 0.13), op(N, L, "MULTIPLY", v, 1 / 0.15)
    row = op(N, L, "FLOOR", U)
    off = op(N, L, "MULTIPLY", op(N, L, "MODULO", row, 2.0), 0.5)  # every other row shifted half a scale
    cv = op(N, L, "SUBTRACT", op(N, L, "FRACT", op(N, L, "ADD", V, off)), 0.5)
    cu = op(N, L, "FRACT", U)
    d = vop(N, L, "LENGTH", combine(N, L, op(N, L, "MULTIPLY", cv, 2.0), cu))
    inside = remap(N, L, d, 0.9, 1.0, 1.0, 0.0, smooth=True)
    height = op(N, L, "MULTIPLY", inside, op(N, L, "MULTIPLY_ADD", cu, 0.7, 0.3))
    groove = remap(N, L, op(N, L, "ABSOLUTE", op(N, L, "SUBTRACT", d, 0.96)), 0.0, 0.07, 1.0, 0.0)
    shade = tuple(c * 0.62 for c in color)
    col = mix_rgb(N, L, op(N, L, "MULTIPLY", groove, 0.55), color, shade)
    L.new(col, N["Principled BSDF"].inputs["Base Color"])
    add_bump(m, op(N, L, "MULTIPLY_ADD", tex_noise(N, L, obj_co(N), 25, 3), 0.15, height), 0.5, 0.02)
    return m

def candy_mat(name, color, rough=0.3):
    return mat(name, color, rough=rough, sss=0.2, coat=0.6)

def gumdrop_mat(name, color):
    """Sugar-coated gumdrop: soft colour, matte, sparkly sugar crystals in the bump."""
    m = mat(name, color, rough=0.62, sss=0.35)
    N, L = m.node_tree.nodes, m.node_tree.links
    vo = N.new("ShaderNodeTexVoronoi"); L.new(obj_co(N), vo.inputs["Vector"])
    vo.inputs["Scale"].default_value = 140
    add_bump(m, vo.outputs["Distance"], 0.35, 0.004)
    return m

def glass_mat(name, color, deep):
    """Hard-candy window glass: deep colour at the frame, glowing warmer and lighter towards the middle,
    like a boiled sweet held up to the light. Windows are flat in their own x-z plane, centred on 0."""
    m = mat(name, color, rough=0.12, coat=1.0, emit=color, strength=0.6)
    N, L = m.node_tree.nodes, m.node_tree.links
    x, y, z = xyz(N, L, obj_co(N))
    d = vop(N, L, "LENGTH", combine(N, L, x, z))
    glow = remap(N, L, d, 0.02, 0.3, 1.0, 0.0, smooth=True)
    light = tuple(min(1.0, c * 1.1 + 0.05) for c in color)
    col = mix_rgb(N, L, glow, deep, light)
    L.new(col, N["Principled BSDF"].inputs["Base Color"])
    L.new(col, N["Principled BSDF"].inputs["Emission Color"])
    return m

def stripe_mat(name, a, b, pattern, freq):
    """Red-and-white candy stripes in object space: "diag" for canes, "radial" for peppermints,
    "spiral" for lollipop swirls (in the object's xy plane)."""
    m = candy_mat(name, a, rough=0.28)
    N, L = m.node_tree.nodes, m.node_tree.links
    x, y, z = xyz(N, L, obj_co(N))
    if pattern == "diag":
        f = op(N, L, "MULTIPLY", op(N, L, "ADD", z, op(N, L, "MULTIPLY", op(N, L, "ADD", x, y), 0.8)), freq)
    else:
        ang = op(N, L, "MULTIPLY", op(N, L, "ARCTAN2", y, x), freq / (2 * math.pi))
        if pattern == "spiral":
            ang = op(N, L, "ADD", ang, op(N, L, "MULTIPLY", vop(N, L, "LENGTH", combine(N, L, x, y)), 14.0))
        f = ang
    band = remap(N, L, op(N, L, "FRACT", f), 0.47, 0.53, smooth=True)
    L.new(mix_rgb(N, L, band, a, b), N["Principled BSDF"].inputs["Base Color"])
    return m

def sugar_mat(name, color=(0.88, 0.89, 0.92)):
    """Powdered-sugar snow for the diorama ground."""
    m = mat(name, color, rough=0.75, sss=0.2)
    N, L = m.node_tree.nodes, m.node_tree.links
    add_bump(m, tex_noise(N, L, obj_co(N), 9, 6), 0.15, 0.03)
    return m

def chocolate_mat():
    m = mat("Chocolate", (0.075, 0.03, 0.014), rough=0.38)
    N, L = m.node_tree.nodes, m.node_tree.links
    add_bump(m, tex_noise(N, L, obj_co(N), 18, 3), 0.08, 0.01)
    return m

WHITE = (0.86, 0.84, 0.80)
# Candy colours, linear.
CANDY = dict(cherry=(0.72, 0.03, 0.04), lime=(0.22, 0.60, 0.04), lemon=(0.95, 0.68, 0.04),
             orange=(0.92, 0.28, 0.02), grape=(0.30, 0.07, 0.50), pink=(0.92, 0.30, 0.48),
             sky=(0.10, 0.40, 0.82))
# Roof frosting tints for the renders. The web export bakes frosting near-white so the browser can
# tint it per house, like the walls in the winter village.
FROST = dict(white=(0.88, 0.86, 0.83), pink=(0.98, 0.42, 0.45), mint=(0.52, 0.86, 0.70),
             lemon=(0.97, 0.85, 0.45), lilac=(0.72, 0.62, 0.95))
FROST_NEUTRAL = (0.86, 0.86, 0.86)

M = dict(
    ginger=gingerbread_mat("Gingerbread"),
    ginger_dark=gingerbread_mat("GingerbreadDark", base=(0.26, 0.085, 0.022), light=(0.36, 0.13, 0.035),
                                edge_col=(0.15, 0.045, 0.011), dark=(0.08, 0.025, 0.007)),
    icing=icing_mat("Icing"),
    choc=chocolate_mat(),
    cane=stripe_mat("CaneStripe", WHITE, CANDY["cherry"], "diag", 7.0),
    mint=stripe_mat("Peppermint", WHITE, CANDY["cherry"], "radial", 8.0),
    swirl=stripe_mat("LollySwirl", CANDY["pink"], WHITE, "spiral", 3.0),
    swirl2=stripe_mat("LollySwirlMint", CANDY["lime"], CANDY["lemon"], "spiral", 3.0),
    stick=mat("Stick", (0.82, 0.78, 0.70), rough=0.6),
    star=candy_mat("StarCandy", CANDY["lemon"]),
    sugar=sugar_mat("Sugar"),
)
GUM = {k: gumdrop_mat(f"Gum_{k}", c) for k, c in CANDY.items()}
GLASS = {k: glass_mat(f"Candyglass_{k}", c, deep) for k, (c, deep) in
         dict(amber=((0.95, 0.42, 0.04), (0.50, 0.11, 0.008)), cherry=((0.85, 0.08, 0.06), (0.32, 0.01, 0.01)),
              lime=((0.35, 0.80, 0.06), (0.06, 0.25, 0.01)), sky=((0.15, 0.50, 0.95), (0.02, 0.12, 0.40))).items()}
GUM_ORDER = ["cherry", "lemon", "lime", "orange", "sky", "pink", "grape"]

_frost = {}
def frosting(color, mode):
    if (color, mode) not in _frost:
        _frost[color, mode] = frosting_mat(f"Frosting{len(_frost)}", color, mode)
    return _frost[color, mode]

# ---------------------------------------------------------------- piping and candy pieces

def densify(pts, step, closed=False):
    pts = [Vector(p) for p in pts]
    out = []
    for i in range(len(pts) if closed else len(pts) - 1):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n = max(1, int((b - a).length / step))
        out += [a.lerp(b, k / n) for k in range(n)]
    if not closed: out.append(pts[-1])
    return out

def pipe(name, pts, parent=None, r=0.02, closed=False, m=None, wobble=0.0015, step=0.1):
    """A line of piped icing: a smooth round tube along `pts`, steady like a practised hand piped it."""
    pts = densify(pts, step, closed)
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = r; cu.bevel_resolution = 2 if r >= 0.022 else 1  # rounder where the line is thick enough to see it
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*(co + Vector([random.uniform(-wobble, wobble) for _ in range(3)])), 1)
    sp.use_cyclic_u = closed
    cu.materials.append(m or M["icing"])
    return link(bpy.data.objects.new(name, cu), parent)

def scallop(a, b, n, depth, k=6):
    """Points along a→b that dip down in `n` arcs, the classic piped garland."""
    a, b = Vector(a), Vector(b)
    pts = []
    for i in range(n * k + 1):
        p = a.lerp(b, i / (n * k))
        p.z -= depth * math.sin(math.pi * (i % k) / k)
        pts.append(p)
    return pts

def gumdrop(name, loc, r, m, parent=None, squash=0.85, segs=(10, 6)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.1], context="VERTS")
    for v in bm.verts:
        k = 1 + 0.18 * (1 - v.co.z)  # wider at the foot, like a real gumdrop
        v.co.x *= k; v.co.y *= k; v.co.z = (v.co.z + 0.1) * squash
    bmesh.ops.scale(bm, vec=(r, r, r), verts=bm.verts)
    return soft(from_bm(name, bm, m, loc, (0, 0, random.uniform(0, 6.3)), parent))

def gum(i): return GUM[GUM_ORDER[i % len(GUM_ORDER)]]

def cane(name, loc, h, parent=None, rz=0.0, r=0.032):
    root = empty(name, loc, rz, parent)
    hook = 0.1
    pts = [(0, 0, 0), (0, 0, h)] + [(hook - hook * math.cos(a), 0, h + hook * math.sin(a))
                                    for a in (math.pi * k / 8 for k in range(1, 9))] + [(2 * hook, 0, h - 0.06)]
    pipe("Cane", pts, root, r=r, m=M["cane"], wobble=0.0, step=0.03)
    return root

def peppermint(name, loc, r, parent=None, rot=(math.pi / 2, 0, 0)):
    return soft(bevel(cone(name, loc, r, r, 0.045, M["mint"], segs=20, parent=parent, rot=rot), 0.015, 2))

def star(name, loc, r, m, parent=None):
    """A five-pointed candy star standing upright, facing -y."""
    bm = bmesh.new()
    pts = [((r if k % 2 == 0 else r * 0.45) * math.sin(math.pi * k / 5), 0.0,
            (r if k % 2 == 0 else r * 0.45) * math.cos(math.pi * k / 5)) for k in range(10)]
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    geom = bmesh.ops.extrude_face_region(bm, geom=[f])["geom"]
    bmesh.ops.translate(bm, vec=(0, 0.06, 0), verts=[g for g in geom if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.translate(bm, vec=(0, -0.03, 0), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(from_bm(name, bm, m, loc, parent=parent), 0.012, 2)

def pyramid(name, loc, hw, h, m, parent=None):
    """Square pyramid with axis-aligned faces, so shingles can run along x + y."""
    bm = bmesh.new()
    base = [bm.verts.new((sx * hw, sy * hw, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    apex = bm.verts.new((0, 0, h))
    for i in range(4): bm.faces.new((base[i], base[(i + 1) % 4], apex))
    bm.faces.new(list(reversed(base)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, m, loc, parent=parent)

def lathe(name, prof, m, loc, parent, segs=8):
    """A round shape turned from (radius, z) points, bottom first; the first point sits on the axis."""
    bm = bmesh.new()
    tip = bm.verts.new((0, 0, prof[0][1]))
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z))
              for i in range(segs)] for r, z in prof[1:]]
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((tip, rings[0][j], rings[0][i]))
        for a_, b_ in zip(rings, rings[1:]):
            bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(name, bm, m, loc, parent=parent)

def drips(parent, a, b, step=0.2, length=(0.05, 0.16), r=0.035):
    """Icing that ran off an edge and set: rounded drops of different lengths hanging from a→b."""
    a, b = Vector(a), Vector(b)
    n = max(2, int((b - a).length / step))
    for k in range(n + 1):
        p = a.lerp(b, k / n) + Vector((random.uniform(-.01, .01), random.uniform(-.01, .01), 0))
        ln = random.uniform(*length)
        rr = r * random.uniform(0.85, 1.1)
        # A rounded bead at the bottom, narrowing to a neck where it leaves the edge.
        prof = [(rr * math.sin(math.pi / 2 * k / 3), -ln + rr * (1 - math.cos(math.pi / 2 * k / 3))) for k in range(4)]
        prof += [(rr * 0.75, -ln + rr + (ln - rr) * 0.5), (rr * 0.6, 0.0)]
        soft(lathe("Drip", prof, M["icing"], p, parent))

# ---------------------------------------------------------------- houses

FACES = {"front": 0.0, "right": math.pi / 2, "back": math.pi, "left": -math.pi / 2}

def on_face(root, face, u, z, W, D):
    """An empty on a wall: local x runs along the wall, -y points out of it."""
    dist = D / 2 if face in ("front", "back") else W / 2
    r = FACES[face]
    return empty(face, (math.sin(r) * dist + math.cos(r) * u, -math.cos(r) * dist + math.sin(r) * u, z), r, root)

def outline(style, w, h, n=8):
    """Window or door shape in the wall's plane (x along the wall, z up), centred on (0, 0), counter-clockwise."""
    if style == "round":
        return [(w / 2 * math.cos(math.pi * k / n), w / 2 * math.sin(math.pi * k / n)) for k in range(2 * n)]
    if style == "arch":
        r = w / 2; spring = h / 2 - r
        return [(-r, -h / 2), (r, -h / 2)] + \
               [(r * math.cos(math.pi * k / n), spring + r * math.sin(math.pi * k / n)) for k in range(n + 1)]
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]

def flat(name, pts2, y, m, parent):
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, y, z)) for x, z in pts2])
    f.normal_update()
    if f.normal.y > 0: f.normal_flip()
    return from_bm(name, bm, m, parent=parent)

def window(g, w, h, style, glass):
    flat("Glass", outline(style, w, h), -0.008, GLASS[glass], g)
    y = -0.022
    pipe("Frame", [(x, y, z) for x, z in outline(style, w + 0.05, h + 0.05)], g, r=0.022, closed=True)
    spring = h / 2 - w / 2 if style == "arch" else 0.0
    top = h / 2 if style != "round" else w / 2
    pipe("Mullion", [(0, y, -top), (0, y, top)], g, r=0.013)
    pipe("Mullion", [(-w / 2, y, spring), (w / 2, y, spring)], g, r=0.013)
    if style != "round":
        pipe("Sill", scallop((-w / 2 - 0.06, y, -h / 2 - 0.07), (w / 2 + 0.06, y, -h / 2 - 0.07), 3, 0.04), g, r=0.016)

def door(g, w, h):
    pts = [(x, z + h / 2) for x, z in outline("arch", w, h)]
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, 0.0, z)) for x, z in pts])
    geom = bmesh.ops.extrude_face_region(bm, geom=[f])["geom"]
    bmesh.ops.translate(bm, vec=(0, -0.045, 0), verts=[e for e in geom if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    from_bm("Door", bm, M["choc"], parent=g)
    y = -0.06
    pipe("DoorFrame", [(x * 1.12, y, (z - h / 2) * 1.06 + h / 2) for x, z in pts], g, r=0.025)
    pipe("DoorSplit", [(0, y, 0.03), (0, y, h - w / 2)], g, r=0.014)
    for x in (-0.07, 0.07):
        gumdrop("Knob", (x, y - 0.005, h * 0.45), 0.03, GUM["cherry"], g).rotation_euler.x = -math.pi / 2
    soft(box("Step", (0, -0.16, 0.03), (w + 0.25, 0.24, 0.07), M["icing"], g, bev=0.03, segs=3, jit=0.008))

def house(name, loc, W, D, Hw, rise, roof="gable", frost="white", windows=(), door_at=None, chimney=None,
          gumdrops=False, canes=False, stones=False, courses=(), dots=False, clock=None, finial=False,
          turn=0.0, rz=0.0, neutral=False):
    root = empty(name, loc, rz + turn)
    color = FROST_NEUTRAL if neutral else FROST[frost]
    B0 = 0.14  # gingerbread footing
    box("Footing", (0, 0, B0 / 2), (W + 0.14, D + 0.14, B0), M["ginger_dark"], root, bev=0.03, segs=3)
    top, ridge = B0 + Hw, B0 + Hw + (rise if roof == "gable" else 0)
    prof = [(-W / 2, B0), (W / 2, B0), (W / 2, top)] + ([(0, ridge)] if roof == "gable" else []) + [(-W / 2, top)]
    bm = bmesh.new()
    fr = [bm.verts.new((x, -D / 2, z)) for x, z in prof]
    bk = [bm.verts.new((x, D / 2, z)) for x, z in prof]
    bm.faces.new(fr); bm.faces.new(list(reversed(bk)))
    for k in range(len(prof)):
        k2 = (k + 1) % len(prof)
        bm.faces.new((fr[k], fr[k2], bk[k2], bk[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bevel(from_bm("Walls", bm, M["ginger"], parent=root), 0.035, 3)  # puffed, rounded baked edges

    # Icing "glue" down every corner, as on a real gingerbread house.
    for sx in (1, -1):
        for sy in (1, -1):
            pipe("Seam", [(sx * (W / 2 + 0.01), sy * (D / 2 + 0.01), B0), (sx * (W / 2 + 0.01), sy * (D / 2 + 0.01), top)],
                 root, r=0.03)
    corners = [(-W / 2, -D / 2), (W / 2, -D / 2), (W / 2, D / 2), (-W / 2, D / 2)]
    for z in courses:  # piped garlands between storeys, on all four walls
        for i in range(4):
            (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
            out = Vector((0, math.copysign(0.025, ay), 0)) if ay == by else Vector((math.copysign(0.025, ax), 0, 0))
            span = math.hypot(bx - ax, by - ay)
            pipe("Garland", scallop(Vector((ax, ay, z)) + out, Vector((bx, by, z)) + out, max(2, round(span / 0.3)), 0.05),
                 root, r=0.017)

    if roof == "gable":
        a = math.atan2(rise, W / 2)
        over, gover, tR, tF = 0.2, 0.14, 0.07, 0.07
        L = math.hypot(W / 2, rise) + over
        Ly = D + 2 * gover
        rp = Vector((0, ridge))
        peak = rp + Vector((0, (tR + tF) / math.cos(a)))
        for s in (1, -1):
            dv = Vector((s * math.cos(a), -math.sin(a)))
            nv = Vector((s * math.sin(a), math.cos(a)))
            t0, t1 = -tR * math.tan(a), L
            c = rp + dv * ((t0 + t1) / 2) + nv * (tR / 2)
            box("Roof", (c.x, 0, c.y), (t1 - t0, Ly, tR), M["ginger"], root, rot=(0, s * a, 0), bev=0.025, segs=3)
            f0, f1 = -(tR + tF) * math.tan(a), L + 0.03
            c = rp + dv * ((f0 + f1) / 2) + nv * (tR + tF / 2)
            soft(box("Frosting", (c.x, 0, c.y), (f1 - f0, Ly + 0.04, tF), frosting(color, "+x" if s > 0 else "-x"), root,
                     rot=(0, s * a, 0), bev=0.03, segs=3, jit=0.005))
            e = rp + dv * f1 + nv * (tR + 0.02)
            drips(root, (e.x, -Ly / 2, e.y), (e.x, Ly / 2, e.y))
            for gy in (-1, 1):  # bead of icing along each gable edge
                eave = rp + dv * f1 + nv * (tR + tF * 0.6)
                pipe("Rake", [(eave.x, gy * (Ly / 2 + 0.03), eave.y), (0, gy * (Ly / 2 + 0.03), peak.y - 0.02)], root, r=0.03)
        pipe("Ridge", [(0, -Ly / 2, peak.y), (0, Ly / 2, peak.y)], root, r=0.045)
        if gumdrops:
            n = max(2, int((Ly - 0.3) / 0.3))
            for k in range(n + 1):
                gumdrop("RidgeGum", (0, lerp(-Ly / 2 + 0.15, Ly / 2 - 0.15, k / n), peak.y + 0.02), 0.085, gum(k), root)
        if dots:  # icing dots following the front gable
            for s in (1, -1):
                for k in range(1, 6):
                    t = k / 6
                    ball("Dot", (s * lerp(W / 2 - 0.16, 0.0, t), -D / 2 - 0.02, lerp(top + 0.02, ridge - 0.2, t)), 0.026,
                         M["icing"], root, segs=(6, 4))
        roof_z = lambda x: ridge - abs(x) * math.tan(a)
    else:
        hw = W / 2 + 0.13
        box("Eave", (0, 0, top + 0.035), (2 * hw, 2 * hw, 0.07), M["ginger"], root, bev=0.015)
        soft(bevel(pyramid("Frosting", (0, 0, top + 0.07), hw + 0.02, rise, frosting(color, "spire"), root), 0.02, 2))
        for i in range(4):
            (ax, ay), (bx, by) = [(sx * (hw + 0.02), sy * (hw + 0.02)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))][i], \
                                 [(sx * (hw + 0.02), sy * (hw + 0.02)) for sx, sy in ((1, -1), (1, 1), (-1, 1), (-1, -1))][i]
            drips(root, (ax, ay, top + 0.09), (bx, by, top + 0.09))
        tip = top + 0.07 + rise
        if finial: gumdrop("Finial", (0, 0, tip - 0.04), 0.12, GUM["cherry"], root, squash=1.1)
        else: star("Star", (0, 0, tip + 0.16), 0.2, M["star"], root)
        roof_z = lambda x: top

    for face, u, z, w, h, style, glass in windows:
        window(on_face(root, face, u, z, W, D), w, h, style, glass)
    if door_at:
        face, u, w, h = door_at
        door(on_face(root, face, u, B0, W, D), w, h)
        if canes:
            g = on_face(root, face, u, 0.0, W, D)
            cane("Cane", (-(w / 2 + 0.17), -0.14, 0), 0.62, g, rz=0.0)
            cane("Cane", (w / 2 + 0.17, -0.14, 0), 0.62, g, rz=math.pi)
    if chimney:
        cx, cy = chimney
        h0, h1 = roof_z(cx) - 0.1, ridge + 0.35
        box("Chimney", (cx, cy, (h0 + h1) / 2), (0.28, 0.28, h1 - h0), M["ginger"], root, bev=0.02, jit=0.006)
        soft(box("ChimneyCap", (cx, cy, h1 + 0.03), (0.36, 0.36, 0.08), frosting(color, "+x"), root, bev=0.03, segs=3))
        drips(root, (cx - 0.17, cy - 0.19, h1), (cx + 0.17, cy - 0.19, h1), step=0.1, length=(0.03, 0.09), r=0.025)
    if stones:  # a border of round candies along the footing
        door_u = door_at[1] if door_at and door_at[0] == "front" else 99
        k = 0
        for i in range(4):
            (ax, ay), (bx, by) = corners[i], corners[(i + 1) % 4]
            n = max(2, int(math.hypot(bx - ax, by - ay) / 0.24))
            for j in range(n):
                t = (j + 0.5) / n
                x, y = lerp(ax, bx, t) * (1 + 0.07 / (W / 2)), lerp(ay, by, t) * (1 + 0.07 / (D / 2))
                if i == 0 and abs(x - door_u) < 0.4: continue
                gumdrop("Candy", (x, y, B0), 0.06, gum(k), root, squash=0.5, segs=(8, 4)); k += 1
    if clock:
        z, r = clock
        g = on_face(root, "front", 0.0, z, W, D)
        peppermint("Clock", (0, -0.03, 0), r, g)
        pipe("ClockRim", [(r * 1.08 * math.cos(t * math.pi / 10), -0.05, r * 1.08 * math.sin(t * math.pi / 10))
                          for t in range(20)], g, r=0.02, closed=True)
    return root

# House designs for the planet, tall and small to make a cluster like the paper-village reference.
# Each is a recipe for house(); the export bakes all of them into one shared texture.
B0 = 0.14
DESIGNS = {
    # Small and friendly: pink frosting, gumdrops on the ridge, candy canes either side of the door.
    "Cottage": dict(W=1.8, D=2.0, Hw=1.05, rise=0.95, frost="pink", gumdrops=True, canes=True, stones=True, dots=True,
        windows=[("front", 0.0, B0 + 1.45, 0.34, 0.34, "round", "cherry"),
                 ("right", -0.45, B0 + 0.58, 0.34, 0.48, "arch", "amber"), ("right", 0.45, B0 + 0.58, 0.34, 0.48, "arch", "amber"),
                 ("left", -0.45, B0 + 0.58, 0.34, 0.48, "arch", "amber"), ("left", 0.45, B0 + 0.58, 0.34, 0.48, "arch", "amber")],
        door_at=("front", 0.0, 0.46, 0.8)),
    # Tall and narrow, three storeys, with a chimney.
    "Townhouse": dict(W=1.5, D=1.7, Hw=2.25, rise=1.0, frost="white", courses=(B0 + 1.08, B0 + 1.8), chimney=(0.35, 0.3),
        windows=[("front", -0.34, B0 + 0.55, 0.3, 0.44, "rect", "amber"),
                 ("front", -0.34, B0 + 1.45, 0.3, 0.44, "arch", "lime"), ("front", 0.34, B0 + 1.45, 0.3, 0.44, "arch", "lime"),
                 ("front", 0.0, B0 + 2.65, 0.3, 0.3, "round", "amber"),
                 ("right", 0.0, B0 + 0.55, 0.3, 0.44, "rect", "amber"), ("right", 0.0, B0 + 1.45, 0.3, 0.44, "arch", "lime"),
                 ("left", 0.0, B0 + 1.45, 0.3, 0.44, "arch", "lime")],
        door_at=("front", 0.34, 0.4, 0.78)),
    # Long and low with the ridge running across the front, gumdrops and a candy border.
    "Hall": dict(W=1.9, D=2.8, Hw=1.35, rise=0.9, frost="mint", turn=math.pi / 2, gumdrops=True, stones=True,
        chimney=(0.45, 0.8), courses=(B0 + 1.2,),
        windows=[("left", -0.85, B0 + 0.68, 0.38, 0.55, "arch", "amber"), ("left", 0.85, B0 + 0.68, 0.38, 0.55, "arch", "amber"),
                 ("right", -0.7, B0 + 0.68, 0.38, 0.55, "arch", "amber"), ("right", 0.7, B0 + 0.68, 0.38, 0.55, "arch", "amber"),
                 ("front", 0.0, B0 + 1.7, 0.38, 0.38, "round", "sky"), ("back", 0.0, B0 + 1.7, 0.38, 0.38, "round", "sky")],
        door_at=("left", 0.0, 0.5, 0.88)),
    # A square tower with a lemon-frosted spire and a gumdrop on top.
    "Tower": dict(W=1.15, D=1.15, Hw=3.0, rise=1.5, roof="spire", frost="lemon", finial=True,
        courses=(B0 + 1.05, B0 + 2.0),
        windows=[(f, 0.0, z, 0.32, 0.55, "arch", g) for f in ("front", "right", "back", "left")
                 for z, g in ((B0 + 1.45, "cherry"), (B0 + 2.4, "amber"))] +
                [(f, 0.0, B0 + 0.55, 0.3, 0.45, "arch", "amber") for f in ("right", "left", "back")],
        door_at=("front", 0.0, 0.42, 0.8)),
    # The tallest: a slim steeple with a peppermint clock and a candy star on its spire.
    "Steeple": dict(W=0.95, D=0.95, Hw=4.1, rise=1.9, roof="spire", frost="white", clock=(B0 + 3.55, 0.27),
        courses=(B0 + 1.2, B0 + 3.15),
        windows=[(f, 0.0, z, 0.26, 0.62, "arch", g) for f in ("front", "right", "back", "left")
                 for z, g in ((B0 + 1.75, "sky"), (B0 + 2.75, "amber"))] +
                [(f, 0.0, B0 + 3.55, 0.3, 0.3, "round", "cherry") for f in ("right", "back", "left")],
        door_at=("front", 0.0, 0.38, 0.75)),
}

def build_design(key, loc, rz=0.0, frost=None, neutral=False):
    d = dict(DESIGNS[key])
    if frost: d["frost"] = frost
    return house(key, loc, rz=rz, neutral=neutral, **d)

# ---------------------------------------------------------------- trees and fixtures

def tier(parent, z0, r, th, scallops, droop):
    """One cookie tier: a shallow cone whose rim dips into scallops, its edge thickly iced."""
    k = scallops * 4
    bm = bmesh.new()
    apex = bm.verts.new((0, 0, z0 + th))
    rings = []
    for (rs, dz) in ((0.92, 0.035), (1.03, 0.0), (0.9, -0.04)):  # icing starts, icing edge, underside
        ring = []
        for i in range(k):
            a = 2 * math.pi * i / k
            s = 0.5 + 0.5 * math.cos(scallops * a)  # 1 at the tip of each scallop
            rr = r * (0.88 + 0.12 * s) * rs
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z0 + dz - droop * s)))
        rings.append(ring)
    under = bm.verts.new((0, 0, z0 + th * 0.35))
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((apex, rings[0][i], rings[0][j])).material_index = 0
        for a_, b_ in ((0, 1), (1, 2)):
            bm.faces.new((rings[a_][i], rings[b_][i], rings[b_][j], rings[a_][j])).material_index = 1
        bm.faces.new((rings[2][i], under, rings[2][j])).material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = soft(from_bm("Tier", bm, [M["ginger"], M["icing"]], parent=parent))
    ob.rotation_euler.z = random.uniform(0, 6.3)
    return ob

def gingertree(name, loc, tiers=5, r0=0.75, r1=0.25, height=2.4, scallops=7, rz=0.0, parent=None):
    root = empty(name, loc, rz, parent)
    cone("Trunk", (0, 0, 0.2), 0.1, 0.08, 0.4, M["ginger_dark"], segs=8, parent=root)
    step = (height - 0.55) / tiers
    k = 0
    for i in range(tiers):
        t = i / max(1, tiers - 1)
        r, z0 = lerp(r0, r1, t), 0.38 + i * step
        th = step * 1.9
        tier(root, z0, r, th, scallops, 0.07)
        for j in range(3 if i < tiers - 1 else 2):  # candy baubles sitting on each tier
            a = random.uniform(0, 6.3) + j * 2.1
            rr = r * 0.72
            gumdrop("Bauble", (math.cos(a) * rr, math.sin(a) * rr, z0 + 0.035 + th * (1 - rr / (r * 0.92))), 0.05, gum(k),
                    root, squash=0.9, segs=(8, 4)); k += random.randint(1, 3)
    star("Star", (0, 0, 0.38 + (tiers - 1) * step + step * 1.9 + 0.12), 0.17, M["star"], root)
    return root

def lollipop(name, loc, h=0.9, r=0.24, m=None, parent=None, rz=0.0):
    root = empty(name, loc, rz, parent)
    cone("Stick", (0, 0, h / 2), 0.022, 0.022, h, M["stick"], segs=8, parent=root)
    soft(bevel(cone("Lolly", (0, 0, h + r * 0.9), r, r, 0.07, m or M["swirl"], segs=24, parent=root,
                    rot=(math.pi / 2, 0, 0)), 0.03, 3))
    return root

def gumdrop_pile(name, loc, parent=None, rz=0.0):
    root = empty(name, loc, rz, parent)
    for i, (x, y, r) in enumerate(((0, 0, 0.26), (0.32, 0.12, 0.19), (-0.24, 0.2, 0.16), (0.12, -0.28, 0.14))):
        gumdrop("Gumdrop", (x, y, 0), r, gum(i * 2 + 1), root)
    return root

# Trees and fixtures, exported alongside the houses.
PROPS = {
    "TallTree": lambda loc, parent=None: gingertree("TallTree", loc, tiers=6, r0=0.62, r1=0.2, height=2.8, scallops=7, parent=parent),
    "PlumpTree": lambda loc, parent=None: gingertree("PlumpTree", loc, tiers=4, r0=0.85, r1=0.34, height=1.9, scallops=8, parent=parent),
    "CandyCane": lambda loc, parent=None: cane("CandyCane", loc, 1.0, parent, r=0.05),
    "Lollipop": lambda loc, parent=None: lollipop("Lollipop", loc, parent=parent),
    "Gumdrops": lambda loc, parent=None: gumdrop_pile("Gumdrops", loc, parent),
}

# ---------------------------------------------------------------- scenes

def ground(radius=9.0):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=96, radius=radius)
    soft(from_bm("Ground", bm, M["sugar"]))

def diorama():
    """A cluster like the paper village: tall towers at the back, small cottages and trees in front."""
    ground()
    for key, x, y, rz, frost in [
            ("Steeple", 1.9, 3.2, 0.1, "white"), ("Tower", -2.1, 2.7, -0.15, "lemon"),
            ("Townhouse", -0.1, 3.0, 0.05, "white"), ("Townhouse", 3.6, 1.4, -0.35, "lilac"),
            ("Hall", 2.2, 0.2, -0.2, "mint"), ("Townhouse", -3.6, 0.9, 0.3, "pink"),
            ("Cottage", -1.3, -0.5, 0.2, "pink"), ("Cottage", 0.9, -2.0, -0.1, "white"),
            ("Cottage", -3.4, -2.0, 0.45, "lemon")]:
        build_design(key, (x, y, 0), rz, frost)
    for key, x, y in [("TallTree", 0.65, 1.0), ("TallTree", -0.95, 1.6), ("PlumpTree", -0.35, -2.4),
                      ("TallTree", 4.6, -0.6), ("PlumpTree", 3.4, -1.9), ("TallTree", -4.6, 2.6),
                      ("PlumpTree", -2.2, -2.9), ("TallTree", 3.9, 3.3)]:
        PROPS[key]((x, y, 0))
    for key, x, y in [("CandyCane", -0.55, -3.6), ("Lollipop", 2.4, -3.1), ("Gumdrops", 1.6, -3.7),
                      ("Lollipop", -4.4, -0.6), ("Gumdrops", -2.4, -4.0), ("CandyCane", 4.9, 0.9)]:
        PROPS[key]((x, y, 0))

def lineup():
    keys = list(DESIGNS)
    for i, k in enumerate(keys):
        build_design(k, ((i - (len(keys) - 1) / 2) * 3.0, 0.0, 0.0))
    props = list(PROPS)
    for i, k in enumerate(props):
        PROPS[k](((i - (len(props) - 1) / 2) * 2.4, -3.4, 0.0))
    ground(12.0)

# ---------------------------------------------------------------- light, world, camera

def stage(kind):
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 4.2; sun_d.color = (1.0, 0.86, 0.70); sun_d.angle = math.radians(3)
    sun = link(bpy.data.objects.new("Sun", sun_d)); sun.rotation_euler = (math.radians(52), 0, math.radians(-38))

    world = bpy.data.worlds.new("World"); scene.world = world
    try: world.use_nodes = True
    except Exception: pass
    N, L = world.node_tree.nodes, world.node_tree.links
    sky = N["Background"]
    sky.inputs["Color"].default_value = (0.45, 0.62, 0.95, 1); sky.inputs["Strength"].default_value = 0.55
    cam_bg = N.new("ShaderNodeBackground"); lpath = N.new("ShaderNodeLightPath"); mix = N.new("ShaderNodeMixShader")
    cam_bg.inputs["Color"].default_value = (0.60, 0.70, 0.85, 1)  # a clear sunny sky behind
    L.new(lpath.outputs["Is Camera Ray"], mix.inputs[0])
    L.new(sky.outputs[0], mix.inputs[1]); L.new(cam_bg.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], N["World Output"].inputs["Surface"])

    cam_d = bpy.data.cameras.new("Cam"); cam_d.clip_end = 200
    cam = link(bpy.data.objects.new("Cam", cam_d)); scene.camera = cam
    if kind == "lineup":
        cam_d.type = "ORTHO"; cam_d.ortho_scale = 17.0
        cam.rotation_euler = (math.radians(72), 0, math.radians(18))
        look = Vector((0, 0, -1)); look.rotate(cam.rotation_euler)
        cam.location = Vector((0, -1.4, 1.6)) - look * 40
    else:
        cam_d.lens = 42 if kind == "diorama" else 50
        target = Vector((0.0, 0.6, 1.9)) if kind == "diorama" else Vector((0.15, 0.0, 1.0))
        cam.location = Vector((1.5, -14.5, 4.6)) if kind == "diorama" else Vector((2.6, -6.4, 2.1))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

    r = scene.render
    r.engine = "CYCLES"
    r.resolution_x, r.resolution_y = args.res
    r.resolution_percentage = 100
    r.filepath = os.path.join(HERE, args.out or f"renders/gingerbread_{kind}.png")
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
    for look_name in ("AgX - Medium High Contrast", "Medium High Contrast"):
        try: vs.look = look_name; break
        except Exception: pass
    vs.exposure = -0.15

# ---------------------------------------------------------------- web export

def descendants(ob):
    out = [ob]
    for c in ob.children: out += descendants(c)
    return out

def join(name, objs):
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs):
        bpy.ops.object.join()
    objs[0].name = objs[0].data.name = name
    return objs[0]

def mesh_copy(ob, dg):
    """The object's mesh with modifiers applied, moved into world space. Its original object-space
    positions ride along as the "lco" attribute so object-space patterns bake as they render."""
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    a = me.attributes.new("lco", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", [c for v in me.vertices for c in v.co])
    me.transform(ob.matrix_world)
    return me

def use_local_coords():
    """Point every material's object-space texture coordinates at the "lco" attribute."""
    for m in bpy.data.materials:
        if not m.node_tree: continue
        N, L = m.node_tree.nodes, m.node_tree.links
        for tc in [n for n in N if n.bl_idname == "ShaderNodeTexCoord"]:
            attr = N.new("ShaderNodeAttribute"); attr.attribute_name = "lco"
            for ln in [ln for ln in L if ln.from_node == tc and ln.from_socket.name == "Object"]:
                L.new(attr.outputs["Vector"], ln.to_socket)

def bake_into(obj, kind, size, samples, non_color=False):
    """Bakes into an RGBA array; alpha is 1 where something was baked and 0 in the gaps between islands."""
    import numpy as np
    img = bpy.data.images.new(f"bake_{kind}", size, size, float_buffer=True, alpha=True)
    img.pixels.foreach_set(np.zeros(size * size * 4, dtype=np.float32))
    if non_color: img.colorspace_settings.name = "Non-Color"
    for m in obj.data.materials:
        tex = m.node_tree.nodes.new("ShaderNodeTexImage"); tex.image = img
        m.node_tree.nodes.active = tex
    scene.cycles.samples = samples
    with bpy.context.temp_override(active_object=obj, selected_objects=[obj]):
        if kind == "DIFFUSE": bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=8)
        elif kind == "NORMAL": bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=8)
        else: bpy.ops.object.bake(type=kind, margin=8)
    import numpy as np
    px = np.empty(size * size * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return px.reshape(-1, 4)

def save_image(name, rgb, size, path, non_color=False):
    import numpy as np
    img = bpy.data.images.new(name, size, size)
    if non_color: img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.concatenate([rgb, np.ones((size * size, 1))], axis=1).astype(np.float32).ravel())
    img.file_format = "PNG"; img.filepath_raw = path; img.save()
    return img

def baked_mat(name, color, normal=None):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    N, L = m.node_tree.nodes, m.node_tree.links
    b = N["Principled BSDF"]
    tc = N.new("ShaderNodeTexImage"); tc.image = color
    L.new(tc.outputs["Color"], b.inputs["Base Color"])
    if normal:
        tn = N.new("ShaderNodeTexImage"); tn.image = normal
        nm = N.new("ShaderNodeNormalMap"); L.new(tn.outputs["Color"], nm.inputs["Color"])
        L.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m

# Every model is exported as one mesh per kind of surface, so the browser can shade each its own way:
# matte-glossy dough, glossy icing, hard shiny candy, sugared gumdrops, glowing candy-glass windows, and
# roof frosting it tints per house. Dough, frosting, candy stripes and windows carry the fine detail, so
# they get a texture sheet of their own (colour, soft shadow, bump); icing and gumdrops are plain
# colours that only need soft shadow, so they share a smaller sheet. Kept apart, the thousands of little
# icing pieces no longer crowd the dough.
CLASSES = ["Dough", "Frosting", "Icing", "Candy", "Gumdrop", "Glass"]
SHEETS = {"dough": ["Dough", "Frosting", "Candy", "Glass"], "trim": ["Icing", "Gumdrop"]}

def shading_class(material_name):
    if material_name.startswith(("Gingerbread", "Chocolate")): return "Dough"  # chocolate wants the same soft sheen
    if material_name.startswith("Frosting"): return "Frosting"
    if material_name.startswith(("Icing", "Stick")): return "Icing"
    if material_name.startswith("Gum_"): return "Gumdrop"
    if material_name.startswith("Candyglass"): return "Glass"
    return "Candy"  # stripes, peppermints, lollipops, the star

def faces_only(name, src, tags, keep, mats):
    """A new object holding the faces of `src` whose tag passes `keep`."""
    bm = bmesh.new(); bm.from_mesh(src.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f, t in zip(bm.faces, tags) if not keep(t)], context="FACES")
    ob = from_bm(name, bm, mats)
    return ob

def unwrap(ob, margin):
    for o in scene.objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")

def fill_gaps(px, rgb):
    """Gaps between islands take `rgb` (default: the average baked colour) instead of black. Tiny islands,
    like an icing dot, share their texels with the gaps once the texture is shrunk for distance, so
    black gaps would turn them dark."""
    import numpy as np
    baked = px[:, 3] > 0.5
    out = px[:, :3].copy()
    out[~baked] = rgb if rgb is not None else out[baked].mean(axis=0)
    return out

def shaded(albedo, ao, floor):
    import numpy as np
    lin = np.clip(fill_gaps(albedo, None) * (floor + (1 - floor) * fill_gaps(ao, (1, 1, 1))[:, :1]), 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)

# The far-off version of each house (<Key>_<Class>Far), drawn instead when the village is at the
# planet's edge: icing tubes, candy and gumdrops lose the extra rings along straight runs and most of
# their sides. They're a pixel or two wide by then, so nothing visibly changes; the UVs, and so the baked
# colour, carry over. Dough, frosting and windows are already cheap and stay as they are. Trees and
# candy fixtures keep their full detail: they're a small share of the triangles, and simplifying the
# trees' scalloped icing visibly took their white outlines away.
FAR = {"Icing": 0.2, "Candy": 0.3, "Gumdrop": 0.35}

def far_copy(ob, ratio):
    far = link(bpy.data.objects.new(f"{ob.name}Far", ob.data.copy()))
    far.data.name = far.name
    mod = far.modifiers.new("Far", "DECIMATE"); mod.ratio = ratio; mod.use_collapse_triangulate = True
    with bpy.context.temp_override(object=far, active_object=far):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    far.data.validate()  # drop any faces the decimation collapsed to nothing
    return far

def export_all(path):
    """Every design and prop in one GLB, as <Key>_<Class> meshes (see CLASSES). Frosting is baked
    near-white so the browser can tint it per house."""
    import numpy as np
    keys = list(DESIGNS) + list(PROPS)
    offsets = {k: Vector((i * 8.0, 0, 0)) for i, k in enumerate(keys)}
    roots = {k: (build_design(k, offsets[k], neutral=True) if k in DESIGNS else PROPS[k](offsets[k])) for k in keys}
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()

    parts = []
    for k in keys:
        for ob in descendants(roots[k]):
            if ob.type not in ("MESH", "CURVE"): continue
            me = mesh_copy(ob, dg)  # keeps the offset while baking so designs don't touch
            copy = link(bpy.data.objects.new(ob.name, me))
            # Tag every face with its model and shading class, to split after baking.
            cls = [CLASSES.index(shading_class(me.materials[p.material_index].name)) for p in me.polygons]
            attr = me.attributes.new("part", "INT", "FACE")
            attr.data.foreach_set("value", [keys.index(k) * len(CLASSES) + c for c in cls])
            parts.append(copy)
    for ob in list(scene.objects):
        if ob not in parts: bpy.data.objects.remove(ob)

    use_local_coords()
    whole = join("Whole", parts)
    bpy.context.view_layer.objects.active = whole
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Triangles before baking, so the normal map's tangents match the ones computed at export.
    bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")
    bpy.ops.object.mode_set(mode="OBJECT")
    tags = [0] * len(whole.data.polygons)
    whole.data.attributes["part"].data.foreach_get("value", tags)
    mats = list(whole.data.materials)
    sheets = {}
    for sheet, classes in SHEETS.items():
        idx = [CLASSES.index(c) for c in classes]
        sheets[sheet] = faces_only(sheet, whole, tags, lambda t: t % len(CLASSES) in idx, mats)
    bpy.data.objects.remove(whole)
    # Nobody sees the undersides resting on the ground; leaving them out gives the dough more texture.
    bm = bmesh.new(); bm.from_mesh(sheets["dough"].data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.7 and f.calc_center_median().z < 0.03], context="FACES")
    bm.to_mesh(sheets["dough"].data); bm.free()
    unwrap(sheets["dough"], 0.003)
    unwrap(sheets["trim"], 0.004)

    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=60)
    ground_ob = from_bm("BakeGround", bm, M["sugar"])
    size = args.bake_size
    os.makedirs(os.path.join(HERE, "renders"), exist_ok=True)
    out_path = lambda n: os.path.join(HERE, "renders", n)
    dough = sheets["dough"]
    dough_color = save_image("DoughColor", shaded(bake_into(dough, "DIFFUSE", size, 1), bake_into(dough, "AO", size, 128), 0.5),
                             size, out_path("gingerbread_dough.png"))
    dough_normal = save_image("DoughNormal", fill_gaps(bake_into(dough, "NORMAL", size, 4, non_color=True), (0.5, 0.5, 1.0)), size,
                              out_path("gingerbread_dough_normal.png"), True)
    trim, tsize = sheets["trim"], size // 2
    trim_color = save_image("TrimColor", shaded(bake_into(trim, "DIFFUSE", tsize, 1), bake_into(trim, "AO", tsize, 128), 0.4),
                            tsize, out_path("gingerbread_trim.png"))
    bpy.data.objects.remove(ground_ob)
    final = {c: baked_mat(f"Ginger{c}", dough_color, dough_normal) for c in SHEETS["dough"]}
    final.update({c: baked_mat(f"Ginger{c}", trim_color) for c in SHEETS["trim"]})

    out = []
    for sheet, classes in SHEETS.items():
        src = sheets[sheet]
        stags = [0] * len(src.data.polygons)
        src.data.attributes["part"].data.foreach_get("value", stags)
        for i, k in enumerate(keys):
            for c in classes:
                tag = i * len(CLASSES) + CLASSES.index(c)
                if tag not in stags: continue
                ob = faces_only(f"{k}_{c}", src, stags, lambda t: t == tag, [final[c]])
                for p in ob.data.polygons: p.material_index = 0
                ob.data.transform(Matrix.Translation(-offsets[k]))
                for name in ("lco", "part"):
                    if name in ob.data.attributes: ob.data.attributes.remove(ob.data.attributes[name])
                out.append(ob)
                if k in DESIGNS and c in FAR: out.append(far_copy(ob, FAR[c]))
        bpy.data.objects.remove(src)

    for o in out:
        print(f"EXPORT {o.name}: {sum(len(p.vertices) - 2 for p in o.data.polygons)} triangles")
    print(f"EXPORT total={sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in out)}")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_tangents=True,
                              export_image_format="WEBP", export_image_quality=88,
                              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                              export_yup=True, export_lights=False, export_cameras=False)

if args.export:
    stage("lineup")
    export_all(os.path.abspath(args.export))
    sys.exit(0)

if args.scene == "diorama": diorama()
elif args.scene == "lineup": lineup()
else:
    ground(6.0)
    build_design("Cottage", (0, 0, 0), 0.0)
    PROPS["PlumpTree"]((1.7, 0.9, 0)); PROPS["Lollipop"]((-1.35, -0.9, 0)); PROPS["Gumdrops"]((1.25, -1.1, 0))
stage(args.scene)
if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, args.blend))
bpy.ops.render.render(write_still=True)
print("WROTE", scene.render.filepath)
