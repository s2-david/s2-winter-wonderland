import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { R } from '../config.js';
import { placeBlocked } from './planet.js';
import { addGrain } from '../grain.js';
import houseUrl from './models/house.glb?url';

// The Scandinavian house modelled in Blender; how to re-export it is in art/blender/README.md.
// Colour and ambient occlusion are baked into one texture; windows are emissive, so the model is
// 3 draw calls, plus 1 for the window halos, and adds no lights.
const MODEL_SCALE = 0.55;

// Soft warm glow, drawn additively. Used for the light on the snow and the halos around windows
// instead of point lights, which would cost every pixel on screen.
function glowMaterial(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
  });
}

// A warm pool on the snow in front of the windows.
function lightPool() {
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    glowMaterial([[0, 'rgba(255, 170, 90, 0.55)'], [0.5, 'rgba(255, 140, 60, 0.18)'], [1, 'rgba(255, 120, 40, 0)']]),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.scale.set(1.5, 1.1, 1);
  pool.position.set(0.15, 0.16, 0.75);
  return pool;
}

// The export marks each window pane with a "Halo" node scaled to the pane. Hang a soft glow a bit
// larger than the pane on each, merged into one mesh so all of them cost a single draw call.
function windowHalos(model) {
  model.updateMatrixWorld(true);
  const toModel = model.matrixWorld.clone().invert();
  const pane = new THREE.PlaneGeometry(2.6, 2.6).translate(0, 0, 0.04);
  const planes = [];
  model.traverse(o => {
    if (o.name.startsWith('Halo')) planes.push(pane.clone().applyMatrix4(toModel.clone().multiply(o.matrixWorld)));
  });
  if (!planes.length) return null;
  return new THREE.Mesh(
    mergeGeometries(planes),
    glowMaterial([[0, 'rgba(255, 170, 80, 0.9)'], [0.4, 'rgba(255, 135, 55, 0.4)'], [1, 'rgba(255, 110, 40, 0)']]),
  );
}

export function placeBlenderHouse(lat, lon) {
  const house = new THREE.Group();
  placeBlocked(house, lat, lon, 0.02, 0.72);

  // Turn the front door toward the starting plaza (the top of the planet, +Z).
  const toStart = new THREE.Vector3(0, 0, R).sub(house.position).applyQuaternion(house.quaternion.clone().invert());
  const facing = new THREE.Group();
  facing.rotation.y = Math.atan2(toStart.x, toStart.z);
  house.add(facing);
  facing.add(lightPool());

  new GLTFLoader().load(houseUrl, ({ scene: model }) => {
    model.scale.setScalar(MODEL_SCALE);
    model.traverse(o => {
      if (!o.isMesh) return;
      const glow = o.material.emissiveIntensity > 0 && o.material.emissive.getHex() !== 0;
      o.castShadow = !glow;
      o.receiveShadow = !glow;
      o.material.flatShading = true;
    });
    addGrain(model);
    const halos = windowHalos(model);
    if (halos) model.add(halos);
    facing.add(model);
  });
  return house;
}
