import { R } from '../config.js';
import { placeBlocked, placeOnSnow } from './planet.js';
import { makeTree, treeReach, makeCobble } from './props.js';
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
  layRoad();

  // Four Blender-made designs, told apart further by wall colour and whether anyone's home.
  // Extra copies of a design add triangles but no draw calls or downloads (see houses.js).
  // Narrower designs make the inner ring; the wide cabins sit in the outer ring where there's room.
  const inner = [
    ['Cottage', '#a3301f', 1], ['Townhouse', '#d6a043', 1], ['Aframe', '#7d9568', 1], ['Cottage', '#5f7f9c', 1],
    ['Townhouse', '#efe8da', 0.12], ['Cottage', '#d6a043', 0.85], ['Aframe', '#b8603a', 0.5], ['Townhouse', '#a3301f', 1],
  ];
  const innerAngles = [-52.5, -17.5, 17.5, 52.5, 127.5, 162.5, 197.5, 232.5];
  const outer = [['Cabin', '#7f97a6', 1, 0], ['Cabin', '#8a6a4f', 0.6, 180]];
  placeHouses([
    ...inner.map(([design, wall, light], i) => ({ design, wall, light, ...aroundBell(15, innerAngles[i]), facing: BELL_SPOT })),
    ...outer.map(([design, wall, light, angle]) => ({ design, wall, light, ...aroundBell(28, angle), facing: BELL_SPOT })),
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

// The road: cobblestones from the north, through the square past the bell, out to the south. Rows
// alternate four and five stones, like laid paving, and stones thin out at the road's ends and edges
// so it fades into the snow rather than stopping in a hard line. Seeded, so it's the same every visit.
const COBBLE_COLORS = ['#7f8b94', '#98a2a8', '#6e7880', '#a39b90', '#8a8580'];

function layRoad() {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const deg = 180 / Math.PI / R; // degrees of arc per unit of distance
  const gap = 0.15; // spacing between stones, in units
  const start = 34, end = -42.8, wander = 1.8, bends = 12;
  const rows = Math.round((start - end) / (gap * deg));

  for (let row = 0; row <= rows; row++) {
    const s = row / rows;
    const lat = start + (end - start) * s;
    const lon = BELL_SPOT[1] + Math.sin(s * bends) * wander;
    // Unit vector across the road, in (east, north) units, so the rows stay square to its bends.
    const cosLat = Math.cos(lat * Math.PI / 180);
    const east = Math.cos(s * bends) * bends * wander * cosLat, north = end - start;
    const len = Math.hypot(east, north);
    const acrossEast = north / len, acrossNorth = -east / len;
    const fromEnd = Math.min(row, rows - row);

    const odd = row % 2, count = 4 + odd;
    for (let k = 0; k < count; k++) {
      const edge = k === 0 || k === count - 1;
      // Five-stone rows pull their smaller edge stones in, so both kinds of row are the same width.
      const offset = (k - (count - 1) / 2) * gap * (odd && edge ? 0.9 : 1);
      if (fromEnd < 6 && rand() * 6 > fromEnd) continue;
      if (edge && rand() < 0.15) continue;
      const stoneLat = lat + (acrossNorth * offset + (rand() - 0.5) * 0.025) * deg;
      const stoneLon = lon + (acrossEast * offset + (rand() - 0.5) * 0.025) * deg / cosLat;
      if (Math.hypot(stoneLat - BELL_SPOT[0], stoneLon - BELL_SPOT[1]) < 2.6) continue; // step around the bell
      const scale = (0.85 + rand() * 0.35) * (odd && edge ? 0.6 : 1);
      const shape = {
        width: 0.9 + rand() * 0.2,
        height: 0.8 + rand() * 0.5,
        yaw: rand() * Math.PI * 2,
        color: COBBLE_COLORS[Math.floor(rand() * COBBLE_COLORS.length)],
      };
      placeOnSnow(makeCobble(scale, shape), stoneLat, stoneLon, 0.008);
    }
  }
}

const KINDS = ['fir', 'spruce', 'bush', 'spire'];

// Collision grows with how far the lowest branches reach.
function plantTree(lat, lon, s, shape = {}, lift) {
  placeBlocked(makeTree(s, shape), lat, lon, lift, 0.2 + 0.45 * treeReach(s, shape));
}
