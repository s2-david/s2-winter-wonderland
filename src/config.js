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
  heroScale: 0.4, // explorer size relative to how the model was first built
  snowDensity: 100,
  snowSize: 0.07,
  snowSpeed: 0.2,
  snowJitter: 0.04, // how far each flake flutters off its path
  snowInertia: 0.35, // seconds the snow takes to catch up when the planet starts or stops turning
  // Paper grain on surfaces (src/grain.js). Strength 0 turns it off.
  // Paper and light defaults were dialled in with the tuning panel.
  grain: 0.95,
  grainBlotch: 0.9, // large soft patches of tone
  grainSize: 0.6, // bigger is coarser fibres and grit
  grainFibre: 0.45,
  grainRelief: 1.2, // how much the grain catches the light
  // Lighting (src/stage.js).
  sunStrength: 1.45,
  sunHeight: 5, // degrees above the horizon, seen from the explorer
  sunAngle: 147, // degrees around the horizon; 0 is straight ahead
  shadowSoftness: 4,
  skyFill: 0.4,
  skyWarmth: 0.34, // 0 is the cool night sky, 1 a warm studio fill
  moonStrength: 1.65,
  exposure: 0.99,
  toneMapping: 1, // 0 none, 1 ACES, 2 AgX
};
