import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { world, placeBlocked, point } from './planet.js';
import { addGrain } from '../grain.js';
import housesUrl from './models/houses.glb?url';

// House designs modelled in Blender; how to re-export them is in art/blender/README.md.
// Every design shares one baked texture. Each design is drawn as instanced meshes (body, walls,
// two window glows, halos), so a design costs the same few draw calls however many copies stand on
// the planet. Walls are baked near-white and tinted per house; windows add no lights.
const MODEL_SCALE = 0.55;

// Per design, in planet units: collision radius, and how far in front of the centre the door is.
const DESIGNS = {
  Cottage: { radius: 0.72, front: 0.72 },
  Townhouse: { radius: 0.62, front: 0.58 },
  Cabin: { radius: 0.86, front: 0.84 },
  Aframe: { radius: 0.66, front: 0.56 },
};

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

function instanced(geometry, material, spots, perInstance) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  spots.forEach((spot, i) => {
    mesh.setMatrixAt(i, spot.matrix);
    if (perInstance) mesh.setColorAt(i, perInstance(spot));
  });
  mesh.computeBoundingSphere();
  world.add(mesh);
  return mesh;
}

// The export marks each window pane with a "Halo_<Design>" node scaled to the pane. One soft glow,
// a bit larger than the pane, goes on each; they're merged so a design's halos are one mesh.
function haloGeometry(model, design) {
  const pane = new THREE.PlaneGeometry(2.6, 2.6).translate(0, 0, 0.04);
  const planes = [];
  model.traverse(o => {
    if (o.name.startsWith(`Halo_${design}`)) planes.push(pane.clone().applyMatrix4(o.matrixWorld));
  });
  return planes.length ? mergeGeometries(planes) : null;
}

// houses: [{ design, wall: '#hex', light: 0 (dark) … 1 (lit), lat, lon, facing? }]
// The front door faces the starting plaza unless `facing` gives another [lat, lon] to face.
export function placeHouses(houses) {
  // Collision anchors go down now, so the explorer can't walk through a house that's still loading.
  const scale = new THREE.Matrix4().makeScale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
  const spots = houses.map(house => {
    const anchor = new THREE.Object3D();
    placeBlocked(anchor, house.lat, house.lon, 0.02, DESIGNS[house.design].radius);
    const [faceLat, faceLon] = house.facing ?? [0, 0];
    const toward = point(faceLat, faceLon).sub(anchor.position).applyQuaternion(anchor.quaternion.clone().invert());
    anchor.rotateY(Math.atan2(toward.x, toward.z));
    anchor.updateMatrix();
    return { ...house, base: anchor.matrix.clone(), matrix: anchor.matrix.clone().multiply(scale) };
  });
  const lightColor = spot => new THREE.Color().setScalar(spot.light);

  // A warm pool of light on the snow in front of each house, dimmer where the windows are dark.
  const pool = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2).scale(1.5, 1, 1.1);
  const poolSpots = spots.map(spot => ({
    ...spot,
    matrix: spot.base.clone().multiply(new THREE.Matrix4().makeTranslation(0.15, 0.16, DESIGNS[spot.design].front + 0.04)),
  }));
  instanced(pool, glowMaterial([[0, 'rgba(255, 170, 90, 0.55)'], [0.5, 'rgba(255, 140, 60, 0.18)'], [1, 'rgba(255, 120, 40, 0)']]),
    poolSpots, lightColor);

  const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  new GLTFLoader().setDRACOLoader(draco).load(housesUrl, ({ scene: model }) => {
    model.updateMatrixWorld(true);
    const haloMaterial = glowMaterial([[0, 'rgba(255, 170, 80, 0.9)'], [0.4, 'rgba(255, 135, 55, 0.4)'], [1, 'rgba(255, 110, 40, 0)']]);
    const glowMaterials = new Map();

    for (const design of Object.keys(DESIGNS)) {
      const mine = spots.filter(spot => spot.design === design);
      if (!mine.length) continue;

      for (const kind of ['Body', 'Walls', 'Glow']) {
        model.getObjectByName(`${design}_${kind}`)?.traverse(o => {
          if (!o.isMesh) return;
          const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
          if (kind === 'Glow') {
            // Unlit and tinted per house, so some houses can have their lights off.
            if (!glowMaterials.has(o.material)) {
              const color = o.material.emissive.clone().multiplyScalar(o.material.emissiveIntensity);
              glowMaterials.set(o.material, new THREE.MeshBasicMaterial({ color }));
            }
            instanced(geometry, glowMaterials.get(o.material), mine, lightColor);
            return;
          }
          const mesh = instanced(geometry, o.material, mine, kind === 'Walls' ? spot => new THREE.Color(spot.wall) : null);
          mesh.castShadow = mesh.receiveShadow = true;
          addGrain(mesh);
        });
      }

      const halos = haloGeometry(model, design);
      if (halos) instanced(halos, haloMaterial, mine, lightColor);
    }
    draco.dispose();
  });
}
