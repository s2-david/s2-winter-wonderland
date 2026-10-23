import { place, placeBlocked } from './planet.js';
import { makeTree, makePathDot } from './props.js';
import { placeHouses } from './houses.js';

// A curved breadcrumb path and a warm village near the starting location.
export function buildVillage() {
  for (let i = 0; i < 24; i++) {
    const lat = -8 + Math.sin(i * 0.42) * 5, lon = -36 + i * 3.2;
    place(makePathDot(), lat, lon, 0.055, 0);
  }

  // The first ten degrees around the explorer are a deliberately obstacle-free snow plaza.
  const trees = [[9, -12, 1.0], [12, 10, 0.83], [-8, 15, 0.85], [17, -18, 0.72], [-16, -18, 0.9], [3, 29, 0.75], [-20, 28, 0.85], [-3, -37, 0.76]];
  trees.forEach(([lat, lon, s]) => placeBlocked(makeTree(s), lat, lon, 0.04, 0.27 + s * 0.18));

  // Four Blender-made designs, told apart further by wall colour and whether anyone's home.
  placeHouses([
    { design: 'Cottage', wall: '#a3301f', light: 1, lat: 11, lon: 9 },
    { design: 'Townhouse', wall: '#d6a043', light: 1, lat: 8, lon: 17 },
    { design: 'Cabin', wall: '#7f97a6', light: 1, lat: -5, lon: 13 },
    { design: 'Aframe', wall: '#7d9568', light: 1, lat: 14, lon: -10 },
    { design: 'Townhouse', wall: '#efe8da', light: 0.12, lat: -13, lon: 23 },
    { design: 'Cabin', wall: '#a3301f', light: 0.85, lat: 19, lon: 22 },
    { design: 'Aframe', wall: '#b8603a', light: 0.5, lat: -19, lon: -25 },
  ]);

  // Denser forest pockets sit outside the broad, winding central path so they become landmarks, not dead ends.
  for (let i = 0; i < 40; i++) {
    const lat = (i * 37) % 84 - 42, lon = (i * 71) % 150 - 75;
    if (Math.abs(lat) < 25 && Math.abs(lon) < 42) continue;
    const s = 0.42 + (i % 4) * 0.13;
    placeBlocked(makeTree(s), lat, lon, 0.03, 0.23 + s * 0.18);
  }
}
