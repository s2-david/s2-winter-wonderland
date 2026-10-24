import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import gingerbreadUrl from './models/gingerbread.glb?url';

// How Gingerbread Land is shaded. Each village has its own material language: the winter village is
// paper (src/grain.js), this one is baked ginger dough, smooth glossy icing and shiny candy, so it
// skips the paper grain. The GLB holds one mesh per kind of surface (<Model>_<Kind>, see
// art/blender/gingerbread.py); each kind gets its own material here. Used by the village and by the
// look-development page (lookdev.html).

// A bright daytime sky to reflect: blue overhead, warm white at the horizon, snow below, and two soft
// panels of light up high so glossy candy and icing catch clean highlights. +Z is up, as it is where
// the explorer stands. The village is always in daylight, so this never changes.
function skyEnvironment(renderer) {
  const sky = new THREE.Scene();
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir;
      void main() {
        vec3 zenith = vec3(0.36, 0.58, 0.92), horizon = vec3(1.0, 0.93, 0.84), snow = vec3(0.82, 0.86, 0.92);
        float up = vDir.z;
        vec3 c = up > 0.0 ? mix(horizon, zenith, pow(up, 0.6)) : mix(horizon, snow, pow(-up, 0.4));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));
  for (const [x, y, z] of [[4, -5, 6], [-6, 2, 5]]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.9, 2.7), side: THREE.DoubleSide }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    sky.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(sky, 0.02).texture;
  pmrem.dispose();
  return env;
}

// Fine dough detail drawn in the shader: small air pores and a soft crumb, in the model's own space so
// they stick to each house. The baked texture holds the broad colour; this keeps the surface reading as
// baked dough up close, where the texture runs out of pixels, at no download cost. Like the paper grain
// (src/grain.js), detail smaller than a pixel fades out so distant walls don't shimmer.
const DOUGH_GLSL = /* glsl */ `
varying vec3 vDoughPos;
vec3 doughHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float doughNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = doughHash(i).x, b = doughHash(i + vec3(1, 0, 0)).x, c = doughHash(i + vec3(0, 1, 0)).x, d = doughHash(i + vec3(1, 1, 0)).x;
  float e = doughHash(i + vec3(0, 0, 1)).x, g = doughHash(i + vec3(1, 0, 1)).x, h = doughHash(i + vec3(0, 1, 1)).x, k = doughHash(i + vec3(1, 1, 1)).x;
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
// 1 inside a pore, 0 on smooth dough. Pores sit at random spots in a grid of cells, each its own size,
// and only some cells have one.
float doughPores(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float pore = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 cell = i + vec3(x, y, z), r = doughHash(cell);
    float size = r.z > 0.4 ? 0.1 + 0.16 * fract(r.x * 7.3) : 0.0;
    pore = max(pore, 1.0 - smoothstep(size * 0.55, size, length(vec3(x, y, z) + r - f)));
  }
  return pore;
}
// Height of the dough surface (pores are pits), faded out once smaller than a pixel.
float doughHeight(vec3 p) {
  float footprint = length(fwidth(p * 24.0));
  float pores = doughPores(p * 24.0) * (1.0 - smoothstep(0.35, 0.9, footprint));
  float crumb = (doughNoise(p * 110.0) - 0.5) * (1.0 - smoothstep(0.1, 0.35, footprint * 4.6));
  return crumb * 0.35 - pores;
}
vec3 doughRelief(vec3 n, float h, float faceDirection) {
  vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition));
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad * 0.4);
}
`;

function doughDetail(material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDoughPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDoughPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DOUGH_GLSL}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat doughH = doughHeight(vDoughPos);\ndiffuseColor.rgb *= 1.0 + min(doughH, 0.0) * 0.5;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = doughRelief(normal, doughH, faceDirection);');
  };
  material.customProgramCacheKey = () => 'dough-detail';
  return material;
}

// Per kind of surface: its material, built from the baked textures in the GLB, and whether it casts a
// shadow. Only the dough does: icing and candy pieces are about one shadow-map pixel wide, so their
// shadows would cost a second draw for almost nothing.
const LOOK = {
  // Baked dough with a slight egg-wash sheen.
  Dough: (src, env) => doughDetail(new THREE.MeshStandardMaterial({
    map: src.map, normalMap: src.normalMap, normalScale: src.normalScale, roughness: 0.55, envMap: env, envMapIntensity: 0.5,
  })),
  // Roof frosting: glossy sugar icing, tinted per house through instance colours.
  Frosting: (src, env) => new THREE.MeshStandardMaterial({
    map: src.map, normalMap: src.normalMap, normalScale: src.normalScale, roughness: 0.32, envMap: env, envMapIntensity: 0.8,
  }),
  // Piped royal icing: bright, smooth, a soft gloss.
  Icing: (src, env) => new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.3, envMap: env, envMapIntensity: 0.85 }),
  // Hard candy: canes, peppermints, lollipops, the stars. A clear glaze over the colour.
  Candy: (src, env) => new THREE.MeshPhysicalMaterial({
    map: src.map, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMap: env, envMapIntensity: 1,
  }),
  // Sugared gumdrops: matte sugar on top, with a little light glowing through the jelly.
  Gumdrop: (src, env) => new THREE.MeshStandardMaterial({
    map: src.map, roughness: 0.55, emissive: 0xffffff, emissiveMap: src.map, emissiveIntensity: 0.22, envMap: env, envMapIntensity: 0.6,
  }),
  // Hard-candy window glass, lit a little from inside.
  Glass: (src, env) => new THREE.MeshPhysicalMaterial({
    map: src.map, roughness: 0.06, clearcoat: 1, emissive: 0xffffff, emissiveMap: src.map, emissiveIntensity: 0.15, envMap: env, envMapIntensity: 1,
  }),
};
export const KINDS = Object.keys(LOOK);

// Resolves to a Map of model name → [{ kind, geometry, material, castShadow }], geometry in the model's
// own space (Y up, Blender units).
export function loadGingerbread(renderer) {
  const env = skyEnvironment(renderer);
  const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  return new GLTFLoader().setDRACOLoader(draco).loadAsync(gingerbreadUrl).then(({ scene: model }) => {
    draco.dispose();
    model.updateMatrixWorld(true);
    const materials = new Map(), models = new Map();
    model.traverse(o => {
      if (!o.isMesh) return;
      const [name, kind] = o.name.split('_');
      if (!LOOK[kind]) return;
      if (!materials.has(kind)) materials.set(kind, LOOK[kind](o.material, env));
      if (!models.has(name)) models.set(name, []);
      models.get(name).push({
        kind, geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: materials.get(kind), castShadow: kind === 'Dough',
      });
    });
    return models;
  });
}
