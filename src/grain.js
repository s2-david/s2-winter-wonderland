import * as THREE from 'three';
import { tuning } from './config.js';
import { world } from './world/planet.js';

// Kraft-paper grain on every lit surface, so the whole scene reads as one handmade paper model.
// It's computed in the shader from surface position: no textures to download, no extra draw calls.
// The grain is pinned to the planet (not the screen), so it stays put on objects as the planet turns.

const strength = { value: tuning.grain };
const planetSpace = { value: new THREE.Matrix4() }; // world → planet-local, updated each frame
const fixedSpace = { value: new THREE.Matrix4() }; // identity, for things that don't ride the planet

const GRAIN_GLSL = /* glsl */ `
uniform float uGrain;
varying vec3 vGrainPos;
float grainHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float grainNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(grainHash(i), grainHash(i + vec3(1, 0, 0)), f.x), mix(grainHash(i + vec3(0, 1, 0)), grainHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(grainHash(i + vec3(0, 0, 1)), grainHash(i + vec3(1, 0, 1)), f.x), mix(grainHash(i + vec3(0, 1, 1)), grainHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
vec3 paperGrain(vec3 p) {
  // Fine detail fades out once it gets smaller than a pixel, so far-off surfaces don't shimmer.
  float footprint = length(fwidth(p));
  float mottle = grainNoise(p * 1.7) * 0.6 + grainNoise(p * 4.3) * 0.4;
  float fibre = grainNoise(p * vec3(42.0, 42.0, 7.0)) * (1.0 - smoothstep(0.01, 0.04, footprint));
  float fine = grainNoise(p * 95.0) * (1.0 - smoothstep(0.004, 0.018, footprint));
  float shade = (mottle - 0.5) * 0.16 + (fibre - 0.5) * 0.11 + (fine - 0.5) * 0.13;
  // Darker blotches lean slightly warm, like the fibres in kraft paper.
  vec3 warm = mix(vec3(1.0), vec3(1.03, 1.0, 0.95), (1.0 - mottle) * 0.6);
  return mix(vec3(1.0), warm * (1.0 + shade), uGrain);
}
`;

function patch(material, space) {
  if (!material.isMeshStandardMaterial || material.userData.grain) return;
  // Glowing windows and lamps stay clean; grain on light sources reads as dirt.
  if (material.emissiveIntensity > 0 && material.emissive.getHex() !== 0) return;
  material.userData.grain = true;
  material.onBeforeCompile = shader => {
    shader.uniforms.uGrain = strength;
    shader.uniforms.uGrainSpace = space;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uGrainSpace;\nvarying vec3 vGrainPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 grainPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          grainPos = instanceMatrix * grainPos;
        #endif
        vGrainPos = (uGrainSpace * modelMatrix * grainPos).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GRAIN_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= paperGrain(vGrainPos);');
  };
  material.customProgramCacheKey = () => 'paper-grain';
  material.needsUpdate = true;
}

// Add grain to every mesh under `root`. Pass onPlanet: false for objects that stay fixed while the
// planet turns (the explorer).
export function addGrain(root, { onPlanet = true } = {}) {
  const space = onPlanet ? planetSpace : fixedSpace;
  root.traverse(o => {
    if (o.isMesh) [].concat(o.material).forEach(m => patch(m, space));
  });
}

export function applyGrainTuning() {
  strength.value = tuning.grain;
}

// Call once per frame after the planet has moved, before rendering.
export function updateGrain() {
  world.updateMatrixWorld();
  planetSpace.value.copy(world.matrixWorld).invert();
}
