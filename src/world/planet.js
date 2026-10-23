import * as THREE from 'three';
import { R } from '../config.js';

// Everything on the planet lives in this group. Walking and steering rotate it beneath the fixed explorer.
export const world = new THREE.Group();

const snowMat = new THREE.MeshStandardMaterial({ color: '#eaf6ff', roughness: 0.9, flatShading: true });
export const ground = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 5), snowMat);
ground.receiveShadow = true;
world.add(ground);

const ice = new THREE.Mesh(
  new THREE.IcosahedronGeometry(R * 1.002, 3),
  new THREE.MeshStandardMaterial({ color: '#ccecff', roughness: 0.65, transparent: true, opacity: 0.18, flatShading: true }),
);
world.add(ice);

// Objects the explorer collides with: { obj, radius }.
export const blockers = [];

export function point(lat, lon, extra = 0) {
  const a = THREE.MathUtils.degToRad(lat), b = THREE.MathUtils.degToRad(lon);
  const r = R + extra;
  return new THREE.Vector3(r * Math.cos(a) * Math.sin(b), r * Math.sin(a), r * Math.cos(a) * Math.cos(b));
}

// The planet is deliberately faceted, so its visible surface sits a little inside the mathematical
// sphere between vertices. Raycast each landmark onto that real surface instead of leaving it to hover.
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

export function placeBlocked(obj, lat, lon, lift, radius) {
  place(obj, lat, lon, lift);
  blockers.push({ obj, radius });
  return obj;
}
