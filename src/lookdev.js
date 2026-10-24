import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { scene, camera, renderer, setDaylight } from './stage.js';
import { loadGingerbread } from './world/gingerbreadLook.js';

// Look development: a model on a patch of snow under the game's own lights, tone mapping and daylight,
// at the size it stands on the planet, to judge shading and texture without walking across the planet.
// Open /lookdev.html (also on Vercel previews, to check on a phone).
const MODEL_SCALE = 0.55; // as in src/world/gingerbread.js
const FROST = { white: '#fff6ea', pink: '#ff9cab', mint: '#a6efcc', lemon: '#ffe486', lilac: '#cfbaff' };

scene.fog.density = 0;
const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: '#eaf6ff', roughness: 0.9 }));
ground.receiveShadow = true;
scene.add(ground);

const turntable = new THREE.Group();
scene.add(turntable);

camera.position.set(0.9, -2.7, 1.3);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0.6);
controls.enableDamping = true;

const ui = {
  model: document.getElementById('model'),
  frost: document.getElementById('frost'),
  daylight: document.getElementById('daylight'),
  spin: document.getElementById('spin'),
};
for (const name of Object.keys(FROST)) ui.frost.add(new Option(name, name));

// A model as the village draws it: one instanced mesh per kind of surface, Z up.
function build(parts, frost) {
  const g = new THREE.Group();
  g.rotation.x = Math.PI / 2; // the GLB is Y up; the planet's surface here is Z up
  g.scale.setScalar(MODEL_SCALE);
  for (const { kind, geometry, material, castShadow } of parts) {
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    if (kind === 'Frosting') mesh.setColorAt(0, new THREE.Color(FROST[frost]));
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

loadGingerbread(renderer).then(models => {
  ui.model.add(new Option('Everything', 'all'));
  for (const name of models.keys()) ui.model.add(new Option(name, name));
  ui.model.value = 'Cottage';
  ui.frost.value = 'pink';

  const show = () => {
    turntable.clear();
    const names = ui.model.value === 'all' ? [...models.keys()] : [ui.model.value];
    names.forEach((name, i) => {
      const g = build(models.get(name), ui.frost.value);
      g.position.x = (i - (names.length - 1) / 2) * 1.8;
      turntable.add(g);
    });
  };
  ui.model.addEventListener('change', show);
  ui.frost.addEventListener('change', show);
  show();
});

const applyDaylight = () => setDaylight(Number(ui.daylight.value));
ui.daylight.addEventListener('input', applyDaylight);
applyDaylight();

renderer.setAnimationLoop(() => {
  if (ui.spin.checked) turntable.rotation.z += 0.004;
  controls.update();
  renderer.render(scene, camera);
});
