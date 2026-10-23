import * as THREE from 'three';
import { tuning } from './config.js';

// Snow falls along the camera's visible vertical (the planet's local +Z at the starting view),
// so it clearly drifts downward rather than reading as motion away from the viewer.
const flakes = 1300;
const pos = new Float32Array(flakes * 3);
for (let i = 0; i < flakes; i++) {
  pos[i * 3] = (Math.random() - 0.5) * 22;
  pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
  pos[i * 3 + 2] = Math.random() * 18 - 3;
}

const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const snowMaterial = new THREE.PointsMaterial({ color: '#fff', size: 0.105, transparent: true, opacity: 0.9, sizeAttenuation: true });
export const snow = new THREE.Points(snowGeo, snowMaterial);

export function applySnowTuning() {
  const intensity = tuning.snowDensity / 100;
  snowGeo.setDrawRange(0, Math.round(flakes * intensity));
  // Flakes reach full opacity at 50%, so the top half of the slider only adds more of them.
  snowMaterial.opacity = 0.15 + 0.75 * Math.min(1, intensity * 2);
  snowMaterial.size = tuning.snowSize;
}

export function updateSnow(dt) {
  const a = snowGeo.attributes.position.array, speed = tuning.snowSpeed;
  for (let i = 2; i < a.length; i += 3) {
    a[i] -= dt * (speed + (i % 7) * 0.09);
    if (a[i] < -5) a[i] = 15;
  }
  snowGeo.attributes.position.needsUpdate = true;
}
