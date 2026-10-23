import { place, placeBlocked } from './planet.js';
import { makeTree, treeReach, makeHouse, makePathDot } from './props.js';
import { placeBlenderHouse } from './blenderHouse.js';

// A curved breadcrumb path and a warm village near the starting location.
export function buildVillage() {
  for (let i = 0; i < 24; i++) {
    const lat = -8 + Math.sin(i * 0.42) * 5, lon = -36 + i * 3.2;
    place(makePathDot(), lat, lon, 0.055, 0);
  }

  // The first ten degrees around the explorer are a deliberately obstacle-free snow plaza.
  const trees = [
    [9, -12, 1.0, { kind: 'spruce', height: 1.1 }], [12, 10, 0.83], [-8, 15, 0.85],
    [17, -18, 0.72, { kind: 'spire' }], [-16, -18, 0.9, { kind: 'bush', width: 1.1 }], [3, 29, 0.75, { kind: 'spruce' }],
    [-20, 28, 0.85, { kind: 'bush', height: 1.2 }], [-3, -37, 0.76, { kind: 'spire', width: 1.2 }],
  ];
  trees.forEach(([lat, lon, s, shape]) => plantTree(lat, lon, s, shape, 0.04));

  // Small stands of mixed trees: a tall one in the middle with smaller, varied ones around it.
  const clusters = [[24, 2, 5], [-26, 4, 4], [30, -32, 6], [-30, 40, 5], [2, 50, 4], [-4, -52, 5]];
  clusters.forEach(([lat, lon, count], c) => {
    plantTree(lat, lon, 1.05, { kind: c % 2 ? 'spruce' : 'fir', height: 1.15 }, 0.04);
    for (let k = 0; k < count; k++) {
      const a = (k / count + c * 0.13) * Math.PI * 2, d = 3.6 + (k % 2) * 0.9;
      const kind = KINDS[(k + c) % KINDS.length];
      const shape = { kind, width: 0.85 + ((k * 7 + c) % 4) * 0.1, height: 0.8 + ((k * 5 + c) % 5) * 0.1 };
      plantTree(lat + Math.cos(a) * d, lon + Math.sin(a) * d / Math.cos(lat * Math.PI / 180), 0.55 + ((k + c) % 3) * 0.15, shape, 0.03);
    }
  });

  // The Blender-made house stands in for the red house that used to be here.
  placeBlenderHouse(11, 9);
  const houses = [['#e8a85e', 8, 17], ['#7b9bd0', -5, 13], ['#bf789a', 14, -10], ['#77aab2', -13, 23], ['#d68c58', 19, 22], ['#9c6bb0', -19, -25]];
  houses.forEach(([color, lat, lon]) => placeBlocked(makeHouse(color), lat, lon, 0.05, 0.55));

  // Denser forest pockets sit outside the broad, winding central path so they become landmarks, not dead ends.
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
