// Planet radius. A larger planet gives the village room to breathe and makes forward travel feel like exploration.
export const R = 10;

export const SKY_COLOR = '#101b3a';

export const ZOOM = { start: 18.5, min: 13.5, max: 36, close: 16, wide: 34 };

// How close the explorer must be to ring the bell.
export const BELL_RANGE = 2.05;

// While the scene is being tuned, the tuning panel shows for every visitor. Set to false to show it
// only with ?debug.
export const SHOW_TUNER = true;

// Values the tuning panel can change at runtime. These defaults are what visitors get.
export const tuning = {
  walkSpeed: 0.2,
  turnSpeed: 0.35,
  heroScale: 0.56, // explorer size relative to how the model was first built
  heroHeight: 0,
  snowDensity: 100,
  snowSize: 0.075,
  snowSpeed: 0.2,
};
