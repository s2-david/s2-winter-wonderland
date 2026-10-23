import * as THREE from 'three';
import { place } from './planet.js';

// Bell landmark. It stands in the middle of the village square (see village.js).
export const BELL_SPOT = [-6, 0]; // lat, lon: straight ahead of where the explorer starts
export const bell = new THREE.Group();

const archMat = new THREE.MeshStandardMaterial({ color: '#805a43', flatShading: true });
const postGeo = new THREE.CylinderGeometry(0.075, 0.1, 1.25, 6);
const p1 = new THREE.Mesh(postGeo, archMat), p2 = p1.clone();
p1.position.x = -0.42;
p2.position.x = 0.42;
p1.position.y = p2.position.y = 0.62;
bell.add(p1, p2);

const beam = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.13), archMat);
beam.position.y = 1.2;
bell.add(beam);

const bellBody = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: '#e7b63f', metalness: 0.45, roughness: 0.28, flatShading: true }),
);
bellBody.position.y = 1.12;
bell.add(bellBody);

const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#5f3b25' }));
clapper.position.y = 0.88;
bell.add(clapper);

export function placeBell() {
  place(bell, ...BELL_SPOT, 0.05);
  const bellGlow = new THREE.PointLight('#ffd373', 1.3, 4);
  bellGlow.position.set(0, 1.1, 0.2);
  bell.add(bellGlow);
}

let swingTime = 0;

export function swingBell() {
  bell.rotation.z = 0.38;
  swingTime = 1.1;
}

export function updateBell(dt) {
  if (swingTime > 0) {
    swingTime -= dt;
    bell.rotation.z *= 0.86;
  } else {
    bell.rotation.z = 0;
  }
}

export function distanceToBell(target) {
  return bell.getWorldPosition(new THREE.Vector3()).distanceTo(target);
}
