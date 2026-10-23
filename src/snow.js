import * as THREE from 'three';
import { tuning } from './config.js';
import { world } from './world/planet.js';

// Snow falls along the camera's visible vertical (the planet's local +Z at the starting view),
// so it clearly drifts downward rather than reading as motion away from the viewer.
const flakes = 1300;
const BOX = { x: 22, y: 18, zMin: -5, zMax: 15 };

// `base` is where each flake really is; the drawn position adds a small flutter on top, so the
// flutter never accumulates into drift.
const base = new Float32Array(flakes * 3);
const pos = new Float32Array(flakes * 3);
const phase = new Float32Array(flakes * 2);
const rate = new Float32Array(flakes);
for (let i = 0; i < flakes; i++) {
  base[i * 3] = (Math.random() - 0.5) * BOX.x;
  base[i * 3 + 1] = (Math.random() - 0.5) * BOX.y;
  base[i * 3 + 2] = Math.random() * 18 - 3;
  phase[i * 2] = Math.random() * Math.PI * 2;
  phase[i * 2 + 1] = Math.random() * Math.PI * 2;
  rate[i] = 0.6 + Math.random() * 0.8;
}
pos.set(base);

// A soft-edged disc, so flakes read as round instead of square points.
function flakeTexture() {
  const size = 64, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const snowGeo = new THREE.BufferGeometry();
snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
// depthWrite off so a flake's transparent corners don't hide the flakes behind it.
const snowMaterial = new THREE.PointsMaterial({ color: '#fff', map: flakeTexture(), size: 0.105, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
export const snow = new THREE.Points(snowGeo, snowMaterial);

export function applySnowTuning() {
  const intensity = tuning.snowDensity / 100;
  snowGeo.setDrawRange(0, Math.round(flakes * intensity));
  // Flakes reach full opacity at 50%, so the top half of the slider only adds more of them.
  snowMaterial.opacity = 0.15 + 0.75 * Math.min(1, intensity * 2);
  // The round flake covers less of its square than the old point did, so draw it a little larger.
  snowMaterial.size = tuning.snowSize * 1.3;
}

const wrap = (v, size) => v - size * Math.floor(v / size + 0.5);

// The air turns with the planet, but the snow takes a moment to catch up when the explorer
// starts or stops walking or turning, and keeps drifting briefly after they stop.
const lastWorld = new THREE.Quaternion().copy(world.quaternion);
const worldSpin = new THREE.Vector3(), snowSpin = new THREE.Vector3();
const delta = new THREE.Quaternion(), step = new THREE.Quaternion(), v = new THREE.Vector3();
let time = 0;

function followWorld(dt) {
  // The rotation the world made since last frame, as an angular velocity.
  delta.copy(world.quaternion).multiply(lastWorld.invert());
  lastWorld.copy(world.quaternion);
  if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
  const angle = 2 * Math.acos(Math.min(1, delta.w));
  const s = Math.sqrt(1 - delta.w * delta.w);
  if (s > 1e-6) worldSpin.set(delta.x / s, delta.y / s, delta.z / s).multiplyScalar(angle / dt);
  else worldSpin.set(0, 0, 0);

  const ease = tuning.snowInertia > 0 ? 1 - Math.exp(-dt / tuning.snowInertia) : 1;
  snowSpin.lerp(worldSpin, ease);
  const spin = snowSpin.length() * dt;
  if (spin < 1e-7) return null;
  return step.setFromAxisAngle(v.copy(snowSpin).normalize(), spin);
}

export function updateSnow(dt) {
  time += dt;
  const turn = followWorld(dt);
  const speed = tuning.snowSpeed, jitter = tuning.snowJitter;
  const n = snowGeo.drawRange.count === Infinity ? flakes : Math.min(flakes, snowGeo.drawRange.count);

  for (let f = 0; f < n; f++) {
    const i = f * 3;
    if (turn) {
      v.set(base[i], base[i + 1], base[i + 2]).applyQuaternion(turn);
      base[i] = wrap(v.x, BOX.x);
      base[i + 1] = wrap(v.y, BOX.y);
      base[i + 2] = v.z > BOX.zMax ? v.z - (BOX.zMax - BOX.zMin) : v.z;
    }
    base[i + 2] -= dt * (speed + (i % 7) * 0.09);
    if (base[i + 2] < BOX.zMin) base[i + 2] = BOX.zMax;

    // Two out-of-step wobbles per axis give an uneven, fluttering path rather than a clean sway.
    const r = rate[f], p = phase[f * 2], q = phase[f * 2 + 1];
    pos[i] = base[i] + jitter * (Math.sin(time * 1.7 * r + p) + 0.4 * Math.sin(time * 5.3 * r + q));
    pos[i + 1] = base[i + 1] + jitter * (Math.sin(time * 1.3 * r + q) + 0.4 * Math.sin(time * 4.1 * r + p));
    pos[i + 2] = base[i + 2] + jitter * 0.5 * Math.sin(time * 2.9 * r + p + q);
  }
  snowGeo.attributes.position.needsUpdate = true;
}
