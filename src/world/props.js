import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Props that repeat a lot are drawn with one InstancedMesh per part, so every tree (or path dot)
// on the planet shares a handful of draw calls. `instanced(model)` returns a factory that hands out
// empty anchors: place()/placeBlocked() position an anchor as usual (and it still works as a
// collision blocker), and when it is added to the world its pose is copied into each part's instances.
// Each instance can also be stretched (width, height) and turned (yaw) about its own up axis.
function instanced(model, capacity) {
  const parts = model.children.map(part => {
    part.updateMatrix();
    return part;
  });
  let meshes = null;
  const pose = new THREE.Matrix4(), shape = new THREE.Matrix4(), m = new THREE.Matrix4();
  const origin = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  return (scale = 1, { width = 1, height = 1, yaw = 0 } = {}) => {
    const anchor = new THREE.Object3D();
    anchor.addEventListener('added', function onAdded() {
      anchor.removeEventListener('added', onAdded);
      if (!meshes) {
        meshes = parts.map(part => {
          const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
          mesh.castShadow = part.castShadow;
          mesh.count = 0;
          anchor.parent.add(mesh);
          return mesh;
        });
      }
      if (meshes[0].count === capacity) throw new Error(`Instanced prop capacity (${capacity}) reached; raise it in props.js`);
      anchor.updateMatrix();
      shape.compose(origin, turn.setFromAxisAngle(up, yaw), size.set(scale * width, scale * height, scale * width));
      pose.multiplyMatrices(anchor.matrix, shape);
      meshes.forEach((mesh, i) => {
        mesh.setMatrixAt(mesh.count++, m.multiplyMatrices(pose, parts[i].matrix));
        mesh.instanceMatrix.needsUpdate = true;
        // Recomputed on the next frustum check, so culling covers every instance.
        mesh.boundingSphere = null;
      });
    });
    return anchor;
  };
}

// Seeded random numbers, so every visit builds the same trees.
function random(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// A repeatable 0–1 value for a point. Keying jitter on position (not vertex index) moves vertices
// that sit on top of each other (seams, cone tips, rims) together, so meshes stay closed.
function noise(x, y, z, seed) {
  const n = Math.sin(Math.round(x * 1e4) * 0.0127 + Math.round(y * 1e4) * 0.0311 + Math.round(z * 1e4) * 0.0743 + seed * 1.7) * 43758.5453;
  return n - Math.floor(n);
}

// Roughen a geometry like the `jit` option in art/blender/winter_house.py.
function jitter(geo, amount, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + (noise(x, y, z, seed) - 0.5) * 2 * amount,
      y + (noise(x, y, z, seed + 1) - 0.5) * 2 * amount,
      z + (noise(x, y, z, seed + 2) - 0.5) * 2 * amount);
  }
  return geo;
}

// Flat-shaded pieces merged into one mesh, each piece coloured through vertex colours,
// so a whole tree is one draw call (plus one for its shadow).
function piece(geo, color, x, y, z) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.translate(x, y, z);
  const c = new THREE.Color(color), colors = [];
  for (let i = 0; i < geo.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// Tree shapes. Tiers shrink by `taper` and rise by `step`; the trunk height sets where the crown starts.
const TREE_KINDS = {
  fir: { tiers: 3, r: 0.55, taper: 0.11, step: 0.33, tierHeight: 0.8, trunk: 0.7 },
  spruce: { tiers: 4, r: 0.42, taper: 0.07, step: 0.34, tierHeight: 0.72, trunk: 0.6 }, // tall and narrow
  bush: { tiers: 2, r: 0.68, taper: 0.16, step: 0.36, tierHeight: 0.78, trunk: 0.5 }, // short and wide
  spire: { tiers: 5, r: 0.36, taper: 0.05, step: 0.3, tierHeight: 0.6, trunk: 0.55 }, // slim and pointed
};

const COLORS = { trunk: '#77503a', lowerCrown: '#286a60', crown: '#377d6d', snow: '#f5fbff', drift: '#eaf6ff' };

// A tree at scale 1, built once per kind. Instances scale, stretch and turn copies of it.
function treeModel(kind, seed) {
  const { tiers: count, r, taper, step, tierHeight, trunk } = TREE_KINDS[kind];
  const rand = random(seed);
  const parts = [piece(new THREE.CylinderGeometry(0.10, 0.15, trunk, 6), COLORS.trunk, 0, trunk / 2, 0)];
  const tiers = Array.from({ length: count }, (_, i) => ({ r: r - i * taper, y: trunk + 0.02 + i * step }));
  tiers.forEach((t, i) => {
    const crown = jitter(new THREE.ConeGeometry(t.r, tierHeight, 7), 0.015, seed + i * 10);
    parts.push(piece(crown, i === 0 ? COLORS.lowerCrown : COLORS.crown, 0, t.y, 0));
  });

  // Snow follows each tier's slope, raised slightly off it, like the roof snow on houses.
  const snowLift = 0.035;
  // Radius of a tier's surface at height h, pushed out by the snow's thickness.
  const snowRadius = (tier, h) => Math.max(0, tier.r * (tier.y + tierHeight / 2 - h) / tierHeight + snowLift);

  // A sleeve of snow on a tier from `top` down to `bottom`. Like the snow on the house roofs it is
  // roughened, and its lower edge hangs down unevenly, with lumps drooping over it like the eave lips.
  const snowSleeve = (tier, top, bottom, s) => {
    const h = top - bottom;
    const geo = new THREE.CylinderGeometry(snowRadius(tier, top), snowRadius(tier, bottom), h, 7, 1, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > 0) continue;
      // Drip the lower edge down by a random amount, keeping it on the tier's slope.
      const yy = bottom + y + h / 2 - noise(x, y, z, s) * 0.1;
      const k = snowRadius(tier, yy) / Math.hypot(x, z);
      p.setXYZ(i, x * k, yy - (bottom + top) / 2, z * k);
    }
    parts.push(piece(jitter(geo, 0.012, s + 3), COLORS.snow, 0, (top + bottom) / 2, 0));

    const lumps = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < lumps; k++) {
      const a = (k + rand() * 0.7) / lumps * Math.PI * 2, y = bottom - 0.03 - rand() * 0.03;
      const rr = snowRadius(tier, y) - 0.02, size = 0.035 + tier.r * 0.07;
      const lump = jitter(new THREE.IcosahedronGeometry(1, 0), 0.25, s + 20 + k);
      lump.scale(size, size * 0.55, size);
      parts.push(piece(lump, COLORS.snow, Math.sin(a) * rr, y, Math.cos(a) * rr));
    }
  };

  // The top tier wears a cap over its tip; every lower tier gets a band where it shows below the tier above.
  const top = tiers[count - 1], capHeight = 0.3 * tierHeight / 0.8;
  const tip = top.y + tierHeight / 2;
  // The cap's top is where the raised slope comes to a point, so it ends in a tip, not a flat top.
  snowSleeve(top, tip + snowLift * tierHeight / top.r, tip - capHeight, seed + 100);
  tiers.slice(0, -1).forEach((tier, i) => {
    // Closely stacked tiers get thinner bands, so slim trees don't turn stripy.
    const bandTop = tiers[i + 1].y - tierHeight / 2 + 0.04, band = Math.min(0.15, step * 0.4) * (0.8 + rand() * 0.3);
    snowSleeve(tier, bandTop, bandTop - band, seed + 200 + i * 10);
  });

  // A low drift banked around the foot of the trunk, like the ones against the house walls.
  const drift = jitter(new THREE.IcosahedronGeometry(1, 1), 0.15, seed + 300);
  drift.scale(r * 0.55, 0.09, r * 0.55);
  parts.push(piece(drift, COLORS.drift, 0, 0.06, 0));

  const tree = new THREE.Mesh(
    mergeGeometries(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
  );
  tree.castShadow = true;
  return new THREE.Group().add(tree);
}

// Room for 5–6 villages' worth of each kind.
const treeFactories = Object.fromEntries(Object.keys(TREE_KINDS).map((kind, i) => [kind, instanced(treeModel(kind, 11 + i * 1000), 512)]));
const treeTurns = random(7);

// shape: { kind, width, height, yaw }. Trees get a random turn unless yaw is given, so repeats don't line up.
export function makeTree(scale = 1, { kind = 'fir', yaw = treeTurns() * Math.PI * 2, ...stretch } = {}) {
  return treeFactories[kind](scale, { yaw, ...stretch });
}

// How far a tree's lowest tier reaches from its trunk, for sizing its collision radius.
export function treeReach(scale = 1, { kind = 'fir', width = 1 } = {}) {
  return TREE_KINDS[kind].r * scale * width;
}

function pathDotModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.25, 0.035, 8),
    new THREE.MeshStandardMaterial({ color: '#b7d3dd', roughness: 1, flatShading: true }),
  ));
  return g;
}

export const makePathDot = instanced(pathDotModel(), 512);
