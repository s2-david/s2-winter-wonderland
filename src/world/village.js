import { place, placeBlocked } from './planet.js';
import { makeTree, makeHouse, makePathDot } from './props.js';
import { placeBlenderHouse } from './blenderHouse.js';

// A curved breadcrumb path and a warm village near the starting location.
export function buildVillage() {
  for (let i = 0; i < 24; i++) {
    const lat = -8 + Math.sin(i * 0.42) * 5, lon = -36 + i * 3.2;
    place(makePathDot(), lat, lon, 0.055, 0);
  }

  // The first ten degrees around the explorer are a deliberately obstacle-free snow plaza.
  const trees = [[9, -12, 1.0], [12, 10, 0.83], [-8, 15, 0.85], [17, -18, 0.72], [-16, -18, 0.9], [3, 29, 0.75], [-20, 28, 0.85], [-3, -37, 0.76]];
  trees.forEach(([lat, lon, s]) => placeBlocked(makeTree(s), lat, lon, 0.04, 0.27 + s * 0.18));

  // The Blender-made house stands in for the red house that used to be here.
  placeBlenderHouse(11, 9);
  const houses = [['#e8a85e', 8, 17], ['#7b9bd0', -5, 13], ['#bf789a', 14, -10], ['#77aab2', -13, 23], ['#d68c58', 19, 22], ['#9c6bb0', -19, -25]];
  houses.forEach(([color, lat, lon]) => placeBlocked(makeHouse(color), lat, lon, 0.05, 0.55));

  // Denser forest pockets sit outside the broad, winding central path so they become landmarks, not dead ends.
  for (let i = 0; i < 40; i++) {
    const lat = (i * 37) % 84 - 42, lon = (i * 71) % 150 - 75;
    if (Math.abs(lat) < 25 && Math.abs(lon) < 42) continue;
    const s = 0.42 + (i % 4) * 0.13;
    placeBlocked(makeTree(s), lat, lon, 0.03, 0.23 + s * 0.18);
  }
}
