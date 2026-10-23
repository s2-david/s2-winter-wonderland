import { place, placeBlocked } from './planet.js';
import { makeTree, treeReach, makePathDot } from './props.js';
import { placeHouses } from './houses.js';
import { BELL_SPOT } from './bell.js';

// The village is a square around the bell: an inner ring of houses facing it, an outer ring behind
// the gaps, and one road crossing the square north to south. The explorer starts on the road at
// the square's north edge, facing the bell; the third-person camera sits behind them, over the
// open road, so no house blocks the first view.

// A spot `r` degrees from the bell in direction `angle` (degrees; 0 is east, 90 is north).
function aroundBell(r, angle) {
  const a = angle * Math.PI / 180;
  const lat = BELL_SPOT[0] + r * Math.sin(a);
  const lon = BELL_SPOT[1] + r * Math.cos(a) / Math.cos(lat * Math.PI / 180);
  return { lat, lon };
}

// The road runs north and south from the bell, so houses and trees keep clear of those directions.
const nearRoad = (angle, margin) => [90, 270].some(road => Math.abs(((angle % 360) + 360) % 360 - road) < margin);

export function buildVillage() {
  // The road: stepping stones from the north, through the square past the bell, out to the south.
  for (let i = 0; i < 25; i++) {
    const lat = 34 - i * 3.2, lon = BELL_SPOT[1] + Math.sin(i * 0.5) * 1.8;
    if (Math.hypot(lat - BELL_SPOT[0], lon - BELL_SPOT[1]) < 2.8) continue; // step around the bell
    place(makePathDot(), lat, lon, 0.055, 0);
  }

  // Four Blender-made designs, told apart further by wall colour and whether anyone's home.
  // Extra copies of a design add triangles but no draw calls or downloads (see houses.js).
  // Narrower designs make the inner ring; the wide cabins sit in the outer ring where there's room.
  const inner = [
    ['Cottage', '#a3301f', 1], ['Townhouse', '#d6a043', 1], ['Aframe', '#7d9568', 1], ['Cottage', '#5f7f9c', 1],
    ['Townhouse', '#efe8da', 0.12], ['Cottage', '#d6a043', 0.85], ['Aframe', '#b8603a', 0.5], ['Townhouse', '#a3301f', 1],
  ];
  const innerAngles = [-52.5, -17.5, 17.5, 52.5, 127.5, 162.5, 197.5, 232.5];
  const outer = [
    ['Cabin', '#a3301f', 0.85, 35], ['Cabin', '#7f97a6', 1, 0], ['Aframe', '#c9b48a', 1, 145],
    ['Cabin', '#8a6a4f', 0.6, 180], ['Cabin', '#7d9568', 1, 215],
  ];
  placeHouses([
    ...inner.map(([design, wall, light], i) => ({ design, wall, light, ...aroundBell(15, innerAngles[i]), facing: BELL_SPOT })),
    ...outer.map(([design, wall, light, angle]) => ({ design, wall, light, ...aroundBell(24, angle), facing: BELL_SPOT })),
  ]);

  // Trees: a ring of mixed shapes around the village, and a pair flanking the road where it enters each side.
  for (let k = 0; k < 16; k++) {
    const angle = k * 22.5 + (k % 2 ? 6 : -4);
    if (nearRoad(angle, 12)) continue;
    const s = 0.7 + (k % 3) * 0.12;
    const { lat, lon } = aroundBell(30.5 + (k % 3) * 1.5, angle);
    plantTree(lat, lon, s, { kind: KINDS[k % KINDS.length], width: 0.9 + (k % 4) * 0.08, height: 0.9 + (k % 3) * 0.1 }, 0.04);
  }
  for (const angle of [70, 110, 250, 290]) {
    const { lat, lon } = aroundBell(18.5, angle);
    plantTree(lat, lon, 0.75, { kind: 'spruce' }, 0.04);
  }

  // Small stands of mixed trees beyond the ring: a tall one in the middle with smaller, varied ones around it.
  const clusters = [[30, 5], [150, 4], [200, 6], [330, 5]];
  clusters.forEach(([angle, count], c) => {
    const { lat, lon } = aroundBell(40, angle);
    plantTree(lat, lon, 1.05, { kind: c % 2 ? 'spruce' : 'fir', height: 1.15 }, 0.04);
    for (let k = 0; k < count; k++) {
      const a = (k / count + c * 0.13) * Math.PI * 2, d = 3.6 + (k % 2) * 0.9;
      const kind = KINDS[(k + c) % KINDS.length];
      const shape = { kind, width: 0.85 + ((k * 7 + c) % 4) * 0.1, height: 0.8 + ((k * 5 + c) % 5) * 0.1 };
      plantTree(lat + Math.cos(a) * d, lon + Math.sin(a) * d / Math.cos(lat * Math.PI / 180), 0.55 + ((k + c) % 3) * 0.15, shape, 0.03);
    }
  });

  // Denser forest pockets further out, so the far side of the planet has landmarks too.
  for (let i = 0; i < 40; i++) {
    const lat = (i * 37) % 84 - 42, lon = (i * 71) % 150 - 75;
    if (Math.abs(lat) < 25 && Math.abs(lon) < 42) continue;
    const s = 0.42 + (i % 4) * 0.13;
    plantTree(lat, lon, s, { kind: KINDS[i % KINDS.length], width: 0.85 + (i % 3) * 0.12, height: 0.85 + (i % 5) * 0.1 }, 0.03);
  }
}

const KINDS = ['fir', 'spruce', 'bush', 'spire'];

// Collision grows with how far the lowest branches reach.
function plantTree(lat, lon, s, shape = {}, lift) {
  placeBlocked(makeTree(s, shape), lat, lon, lift, 0.2 + 0.45 * treeReach(s, shape));
}
