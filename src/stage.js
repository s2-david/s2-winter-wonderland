import * as THREE from 'three';
import { SKY_COLOR, tuning } from './config.js';

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

// The explorer stands at the top of the planet (+Z), so the sun's height and direction are measured
// from there: height in degrees above the horizon, direction in degrees around it.
export function applyLightTuning() {
  const height = THREE.MathUtils.degToRad(tuning.sunHeight), dir = THREE.MathUtils.degToRad(tuning.sunAngle);
  sun.position.set(Math.cos(height) * Math.sin(dir), Math.cos(height) * Math.cos(dir), Math.sin(height)).multiplyScalar(15);
  sun.intensity = tuning.sunStrength;
  sun.shadow.radius = tuning.shadowSoftness;
  sky.intensity = tuning.skyFill;
  sky.color.lerpColors(SKY.cool, SKY.warm, tuning.skyWarmth);
  sky.groundColor.lerpColors(GROUND.cool, GROUND.warm, tuning.skyWarmth);
  moon.intensity = tuning.moonStrength;
  renderer.toneMappingExposure = tuning.exposure;
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
