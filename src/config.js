// Planet radius. A larger planet gives the village room to breathe and makes forward travel feel like exploration.
export const R = 10;

export const SKY_COLOR = '#101b3a';

export const ZOOM = { start: 18.5, min: 13.5, max: 36, close: 16, wide: 34 };

// How close the explorer must be to ring the bell.
export const BELL_RANGE = 2.05;

// Values the debug tuner (?debug) can change at runtime. These defaults are what ships.
export const tuning = {
  walkSpeed: 0.5,
  turnSpeed: 0.5,
  heroHeight: 0.12,
  snowDensity: 70,
  snowSize: 0.105,
  snowSpeed: 1.45,
};
