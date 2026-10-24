import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { R } from '../config.js';

// Everything on the planet lives in this group. Walking and steering rotate it beneath the fixed explorer.
export const world = new THREE.Group();

// Soft snow drifts: overlapping rounded mounds, broad ones with smaller ones on top. Seeded, so the
// planet is the same on every visit. Each is { dir, cosReach, height }.
const drifts = [];
let seed = 7;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const [count, reach, height] of [[70, [0.22, 0.38], 0.32], [220, [0.08, 0.15], 0.1]]) {
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    const angle = THREE.MathUtils.lerp(reach[0], reach[1], rand());
    drifts.push({ dir, cosReach: Math.cos(angle), height: height * (0.5 + rand() * 0.5) });
  }
}

// Height of the snow above R along a unit direction in the planet's own frame.
export function snowHeight(dir) {
  let h = 0;
  for (const d of drifts) {
    const c = dir.dot(d.dir);
    if (c <= d.cosReach) continue;
    const t = (1 - c) / (1 - d.cosReach); // 0 at the mound's top, 1 at its edge (about angle² / reach²)
    h += d.height * (1 - t) * (1 - t);
  }
  return h;
}

function snowGeometry() {
  // Shared vertices and smooth normals, so the drifts read as soft rather than faceted. Detail 31
  // (about 20k triangles, edges about a third of a unit) is fine enough to keep the small drifts round.
  const geo = mergeVertices(new THREE.IcosahedronGeometry(R, 31));
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    v.multiplyScalar(R + snowHeight(v));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const snowMat = new THREE.MeshStandardMaterial({ color: '#eaf6ff', roughness: 0.9 });
export const ground = new THREE.Mesh(snowGeometry(), snowMat);
ground.receiveShadow = true;
world.add(ground);

// Objects the explorer collides with: { obj, radius }.
export const blockers = [];

export function point(lat, lon, extra = 0) {
  const a = THREE.MathUtils.degToRad(lat), b = THREE.MathUtils.degToRad(lon);
  const r = R + extra;
  return new THREE.Vector3(r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b));
}

// The snow rises and falls in drifts. Raycast each landmark onto the real surface so it neither hovers
// nor sinks.
const surfaceRaycaster = new THREE.Raycaster();
function surfacePoint(lat, lon, lift = 0) {
  const radial = point(lat, lon).normalize();
  surfaceRaycaster.set(radial.clone().multiplyScalar(R + 3), radial.clone().negate());
  const hit = surfaceRaycaster.intersectObject(ground, false)[0];
  return hit ? hit.point.addScaledVector(radial, lift) : point(lat, lon, lift);
}

export function place(obj, lat, lon, lift = 0, embed = 0.13) {
  const p = surfacePoint(lat, lon, lift - embed);
  obj.position.copy(p);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
  world.add(obj);
  return obj;
}

// For flat things laid on the snow (cobbles): tilt to the slope of the snow surface itself rather
// than standing straight up from the planet's centre, so no edge lifts off a drift's side, and sink
// the centre `sink` below the surface so the object sits in the snow.
export function placeOnSnow(obj, lat, lon, sink = 0) {
  const radial = point(lat, lon).normalize();
  surfaceRaycaster.set(radial.clone().multiplyScalar(R + 3), radial.clone().negate());
  const hit = surfaceRaycaster.intersectObject(ground, false)[0];
  const up = hit ? hit.face.normal : radial;
  obj.position.copy(hit ? hit.point : point(lat, lon)).addScaledVector(up, -sink);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  world.add(obj);
  return obj;
}

// Groups of things around one spot, hidden while that spot is over the horizon. Instanced meshes are
// culled only as a whole, so without this a village would still be drawn (and shadowed) from the far
// side of the planet. `reach` is how far, in degrees, the group spreads from its spot.
const horizonGroups = [];
export function horizonGroup(lat, lon, reach) {
  const group = new THREE.Group();
  world.add(group);
  horizonGroups.push({ group, dir: point(lat, lon).normalize(), limit: THREE.MathUtils.degToRad(90 + reach) });
  return group;
}

// The explorer stands at +Z (see daylight.js). Call once per frame after the planet has moved.
const EXPLORER = new THREE.Vector3(0, 0, 1), toward = new THREE.Vector3();
export function updateHorizon() {
  for (const h of horizonGroups) {
    h.group.visible = toward.copy(h.dir).applyQuaternion(world.quaternion).angleTo(EXPLORER) < h.limit;
  }
}

export function placeBlocked(obj, lat, lon, lift, radius) {
  place(obj, lat, lon, lift);
  blockers.push({ obj, radius });
  return obj;
}
