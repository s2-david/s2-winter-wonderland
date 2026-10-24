import * as THREE from 'three';
import { placeBlocked, point, horizonGroup } from './planet.js';
import { renderer } from '../stage.js';
import { loadGingerbread } from './gingerbreadLook.js';

// Gingerbread Land: the second village, on the sunny far side of the planet, straight opposite the
// winter village. A cluster of gingerbread houses, tall and small, around a steeple, with gingerbread
// trees and candy along the paths. Models and materials come from gingerbreadLook.js. main.js loads this
// module on its own, so its code and model download after the winter village is up.
export const GINGER_SPOT = [0, 180]; // lat, lon
const MODEL_SCALE = 0.55;

// Everything drawn for the village, hidden while it is over the horizon. It reaches out to its ring of trees.
const land = horizonGroup(...GINGER_SPOT, 46);

// Per model, the collision radius in planet units.
const RADIUS = {
  Cottage: 0.6, Townhouse: 0.52, Hall: 0.8, Tower: 0.42, Steeple: 0.36,
  TallTree: 0.3, PlumpTree: 0.38, CandyCane: 0.08, Lollipop: 0.12, Gumdrops: 0.28,
};

// Roof frosting tints. The frosting is baked near-white, so each house can wear any of these.
const FROST = { white: '#fff6ea', pink: '#ff9cab', mint: '#a6efcc', lemon: '#ffe486', lilac: '#cfbaff' };

// A spot `r` degrees from the centre in direction `angle` (degrees; 0 is east, 90 is north).
function around(r, angle) {
  const a = angle * Math.PI / 180;
  const lat = GINGER_SPOT[0] + r * Math.sin(a);
  const lon = GINGER_SPOT[1] + r * Math.cos(a) / Math.cos(lat * Math.PI / 180);
  return { lat, lon };
}

// Four paths lead in from north, south, east and west; nothing stands on them.
const onPath = (angle, margin) => [0, 90, 180, 270].some(p => Math.abs((((angle - p) % 360) + 540) % 360 - 180) < margin);

function layout() {
  const houses = [{ key: 'Steeple', frost: 'white', ...around(0, 0), yaw: Math.PI / 4 }];

  // Inner ring, facing the steeple: two houses between each pair of paths, a tall one beside a small one.
  // Set well back (about 3 units) so the plaza between them and the steeple is open to walk around.
  const inner = [['Cottage', 'pink'], ['Tower', 'lemon'], ['Townhouse', 'mint'], ['Cottage', 'lilac'],
    ['Tower', 'pink'], ['Cottage', 'lemon'], ['Townhouse', 'pink'], ['Cottage', 'mint']];
  [24, 66, 114, 156, 204, 246, 294, 336].forEach((angle, i) =>
    houses.push({ key: inner[i][0], frost: inner[i][1], ...around(17, angle), facing: GINGER_SPOT }));

  // Outer ring, behind the gaps between inner pairs: the wide halls and a tall house, so the skyline
  // steps up and down. Kept to four for the triangle budget.
  const outer = [['Hall', 'mint'], ['Townhouse', 'lilac'], ['Hall', 'lemon'], ['Tower', 'mint']];
  [45, 135, 225, 315].forEach((angle, i) =>
    houses.push({ key: outer[i][0], frost: outer[i][1], ...around(29, angle), facing: GINGER_SPOT }));

  const props = [];
  // Gingerbread trees in the gaps of the inner ring and in a loose ring outside the village.
  for (const angle of [45, 135, 225, 315]) props.push({ key: 'TallTree', ...around(22, angle), scale: 0.9 });
  for (let k = 0; k < 14; k++) {
    const angle = k * 360 / 14 + (k % 2 ? 5 : -3);
    if (onPath(angle, 9)) continue;
    props.push({ key: k % 3 ? 'TallTree' : 'PlumpTree', ...around(38 + (k % 3) * 2, angle), scale: 0.85 + (k % 4) * 0.1 });
  }
  // Candy canes line each path in pairs, with lollipops and gumdrops where the paths meet the village.
  for (const p of [0, 90, 180, 270]) {
    for (const r of [26]) for (const side of [-1, 1]) {
      // 3.2° (0.56 units) either side of the path's centre line, leaving the explorer room to pass.
      props.push({ key: 'CandyCane', ...around(r, p + side * THREE.MathUtils.radToDeg(3.2 / r)) });
    }
    props.push({ key: 'Lollipop', ...around(12, p + 16) }, { key: 'Gumdrops', ...around(12, p - 16) });
  }
  return { houses, props };
}

// Pose an anchor on the planet: standing on the snow, turned toward `facing` or by `yaw`.
function spot({ key, lat, lon, facing, yaw, scale = 1 }, rand) {
  const anchor = new THREE.Object3D();
  placeBlocked(anchor, lat, lon, 0.02, RADIUS[key] * scale);
  if (facing) {
    const toward = point(...facing).sub(anchor.position).applyQuaternion(anchor.quaternion.clone().invert());
    anchor.rotateY(Math.atan2(toward.x, toward.z));
  } else {
    anchor.rotateY(yaw ?? rand() * Math.PI * 2);
  }
  anchor.scale.setScalar(MODEL_SCALE * scale);
  anchor.updateMatrix();
  return anchor.matrix;
}

function instanced(geometry, material, matrices, colors, shadow) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    if (colors) mesh.setColorAt(i, new THREE.Color(colors[i]));
  });
  mesh.computeBoundingSphere();
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  land.add(mesh);
}

export function buildGingerbreadLand() {
  let seed = 23;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Collision goes down now, so the explorer can't walk through anything still loading.
  const { houses, props } = layout();
  const placed = [...houses, ...props].map(item => ({ ...item, matrix: spot(item, rand) }));

  // One instanced mesh per model and kind of surface, so every copy of a model shares a few draw calls.
  loadGingerbread(renderer).then(models => {
    for (const [key, parts] of models) {
      const mine = placed.filter(item => item.key === key);
      if (!mine.length) continue;
      for (const { kind, geometry, material, castShadow } of parts) {
        instanced(geometry, material, mine.map(item => item.matrix),
          kind === 'Frosting' ? mine.map(item => FROST[item.frost]) : null, castShadow);
      }
    }
  });
}
