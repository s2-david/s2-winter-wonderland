// Planet radius. A larger planet gives the village room to breathe and makes forward travel feel like exploration.
export const R = 10;

export const SKY_COLOR = '#101b3a';
// The far side of the planet is in daylight (src/daylight.js).
export const DAY_SKY_COLOR = '#a9d2f2';

export const ZOOM = { start: 18.5, min: 13.5, max: 36, close: 16, wide: 34 };

// How close the explorer must be to ring the bell.
export const BELL_RANGE = 2.05;

// While the scene is being tuned, the tuning panel shows for every visitor. Set to false to show it
// only with ?debug.
export const SHOW_TUNER = true;

// Values the tuning panel can change at runtime. These defaults are what visitors get.
export const tuning = {
  walkSpeed: 0.2,
  turnSpeed: 5.5,
  heroScale: 0.56, // explorer size relative to how the model was first built
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
  // Daylight on the far side of the planet (src/daylight.js). The light values above are the night
  // at the village; these are what they become in full day.
  dawnStart: 60, // degrees walked from the village before the sky starts to lighten
  dawnEnd: 150, // degrees walked from the village to reach full day
  daySunStrength: 2.6,
  daySunHeight: 50,
  daySkyFill: 1.4,
  daySkyWarmth: 0.15,
  dayMoonStrength: 0,
  dayExposure: 1.05,
};
