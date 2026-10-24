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

// Per kind of surface: its material, built from the baked textures in the GLB, and whether it casts a
// shadow. Only the dough does: icing and candy pieces are about one shadow-map pixel wide, so their
// shadows would cost a second draw for almost nothing.
const LOOK = {
  // Baked dough with a slight egg-wash sheen.
  Dough: (src, env) => new THREE.MeshStandardMaterial({
    map: src.map, normalMap: src.normalMap, normalScale: src.normalScale, roughness: 0.55, envMap: env, envMapIntensity: 0.5,
  }),
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
