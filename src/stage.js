import * as THREE from 'three';
import { SKY_COLOR, DAY_SKY_COLOR, tuning } from './config.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.FogExp2(SKY_COLOR, 0.035);

export const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 100);
// At the starting point the planet's local "up" is +Z, not Three's usual +Y.
// Keeping the camera aligned to that normal prevents the third-person view from rolling over the horizon.
camera.up.set(0, 0, 1);

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
// Plain PCF (not PCFSoft) so the shadow blur radius can be tuned.
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const sky = new THREE.HemisphereLight('#b7ddff', '#293756', 2.3);
scene.add(sky);
const sun = new THREE.DirectionalLight('#ffe1a5', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
const moon = new THREE.DirectionalLight('#94bcff', 1.1);
moon.position.set(8, 3, -5);
scene.add(moon);

// Cool night sky by default; "sky warmth" moves the fill toward a warm studio light.
const SKY = { cool: new THREE.Color('#b7ddff'), warm: new THREE.Color('#ffe8cc') };
const GROUND = { cool: new THREE.Color('#293756'), warm: new THREE.Color('#6a5d57') };
const TONE_MAPPINGS = [THREE.NoToneMapping, THREE.ACESFilmicToneMapping, THREE.AgXToneMapping];
const BACKDROP = { night: new THREE.Color(SKY_COLOR), day: new THREE.Color(DAY_SKY_COLOR) };
// A low sun is golden; the midday sun is nearly white so the snow reads white rather than cream.
const SUN = { low: new THREE.Color('#ffe1a5'), high: new THREE.Color('#fff8ee') };

// 0 is night at the village, 1 full day on the far side of the planet.
let daylight = 0;
export const getDaylight = () => daylight;
export function setDaylight(amount) {
  if (Math.abs(amount - daylight) < 0.002) return;
  daylight = amount;
  applyLightTuning();
}

// Each light value runs from its night tuning to its day tuning as the explorer walks into daylight.
const blend = (night, day) => THREE.MathUtils.lerp(night, day, daylight);

// The explorer stands at the top of the planet (+Z), so the sun's height and direction are measured
// from there: height in degrees above the horizon, direction in degrees around it.
export function applyLightTuning() {
  const height = THREE.MathUtils.degToRad(blend(tuning.sunHeight, tuning.daySunHeight)), dir = THREE.MathUtils.degToRad(tuning.sunAngle);
  sun.position.set(Math.cos(height) * Math.sin(dir), Math.cos(height) * Math.cos(dir), Math.sin(height)).multiplyScalar(15);
  sun.intensity = blend(tuning.sunStrength, tuning.daySunStrength);
  sun.color.lerpColors(SUN.low, SUN.high, daylight);
  sun.shadow.radius = tuning.shadowSoftness;
  sky.intensity = blend(tuning.skyFill, tuning.daySkyFill);
  const warmth = blend(tuning.skyWarmth, tuning.daySkyWarmth);
  sky.color.lerpColors(SKY.cool, SKY.warm, warmth);
  sky.groundColor.lerpColors(GROUND.cool, GROUND.warm, warmth);
  moon.intensity = blend(tuning.moonStrength, tuning.dayMoonStrength);
  scene.background.lerpColors(BACKDROP.night, BACKDROP.day, daylight);
  scene.fog.color.copy(scene.background);
  renderer.toneMappingExposure = blend(tuning.exposure, tuning.dayExposure);
  const toneMapping = TONE_MAPPINGS[tuning.toneMapping];
  if (renderer.toneMapping !== toneMapping) {
    renderer.toneMapping = toneMapping;
    // Tone mapping is compiled into each shader, so materials need rebuilding when it changes.
    scene.traverse(o => o.material && [].concat(o.material).forEach(m => { m.needsUpdate = true; }));
  }
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
