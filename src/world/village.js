import { place, placeBlocked } from './planet.js';
import { makeTree, makePathDot } from './props.js';
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

  // Trees: a ring around the village, and a pair flanking the road where it enters each side.
  for (let k = 0; k < 16; k++) {
    const angle = k * 22.5 + (k % 2 ? 6 : -4);
    if (nearRoad(angle, 12)) continue;
    const s = 0.7 + (k % 3) * 0.12;
    const { lat, lon } = aroundBell(30.5 + (k % 3) * 1.5, angle);
    placeBlocked(makeTree(s), lat, lon, 0.04, 0.27 + s * 0.18);
  }
  for (const angle of [70, 110, 250, 290]) {
    const { lat, lon } = aroundBell(18.5, angle);
    placeBlocked(makeTree(0.75), lat, lon, 0.04, 0.27 + 0.75 * 0.18);
  }

  // Denser forest pockets further out, so the far side of the planet has landmarks too.
  for (let i = 0; i < 40; i++) {
    const lat = (i * 37) % 84 - 42, lon = (i * 71) % 150 - 75;
    if (Math.abs(lat) < 25 && Math.abs(lon) < 42) continue;
    const s = 0.42 + (i % 4) * 0.13;
    placeBlocked(makeTree(s), lat, lon, 0.03, 0.23 + s * 0.18);
  }
}
