import * as THREE from 'three';
import { R, tuning } from './config.js';
import { world, blockers } from './world/planet.js';
import { moveIntent } from './input.js';

// Explorer stays planted and always faces the forward screen direction while the planet moves underneath.
export const hero = new THREE.Group();
hero.position.set(0, 0, R + tuning.heroHeight);
hero.rotation.x = Math.PI / 2;

const avatar = new THREE.Group();
hero.add(avatar);

// The explorer is a snowman: three stacked snowballs, coal eyes, a carrot nose and stick arms.
const snow = new THREE.MeshStandardMaterial({ color: '#f5fbff', flatShading: true });
const coal = new THREE.MeshStandardMaterial({ color: '#23232b', flatShading: true });
const wood = new THREE.MeshStandardMaterial({ color: '#5f3b25', flatShading: true });

for (const [radius, y] of [[0.24, 0.22], [0.18, 0.56], [0.14, 0.82]]) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), snow);
  ball.position.y = y;
  avatar.add(ball);
}

const eyeGeometry = new THREE.SphereGeometry(0.026, 6, 4);
for (const x of [-0.05, 0.05]) {
  const eye = new THREE.Mesh(eyeGeometry, coal);
  eye.position.set(x, 0.86, 0.125);
  avatar.add(eye);
}

const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 6), new THREE.MeshStandardMaterial({ color: '#d68c58', flatShading: true }));
nose.rotation.x = Math.PI / 2;
nose.position.set(0, 0.81, 0.2);
avatar.add(nose);

// Each arm pivots at the shoulder, so the geometry starts at its base rather than its middle.
const stickGeometry = new THREE.CylinderGeometry(0.012, 0.018, 0.34, 5).translate(0, 0.17, 0);
const twigGeometry = new THREE.CylinderGeometry(0.008, 0.012, 0.12, 4).translate(0, 0.06, 0);
const arms = [-1, 1].map((side) => {
  const arm = new THREE.Group();
  arm.position.set(side * 0.15, 0.6, 0);
  arm.rotation.z = -side * 1.05;
  const twig = new THREE.Mesh(twigGeometry, wood);
  twig.position.y = 0.22;
  twig.rotation.z = side * 0.7;
  arm.add(new THREE.Mesh(stickGeometry, wood), twig);
  avatar.add(arm);
  return arm;
});

// A bright scarf knot marks the explorer's fixed, forward-facing heading.
const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd260', flatShading: true }));
scarf.position.set(0, 0.7, 0.13);
avatar.add(scarf);

export function applyHeroTuning() {
  avatar.scale.setScalar(tuning.heroScale);
  hero.position.z = R + tuning.heroHeight;
}

function wouldHitBlocker() {
  world.updateMatrixWorld(true);
  return blockers.some(({ obj, radius }) => obj.getWorldPosition(new THREE.Vector3()).distanceTo(hero.position) < radius + 0.21);
}

function tryMoveAt(directionHeading, amount) {
  const old = world.quaternion.clone();
  const direction = new THREE.Vector3(Math.sin(directionHeading), Math.cos(directionHeading), 0);
  const axis = new THREE.Vector3(0, 0, 1).cross(direction).normalize();
  world.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, -amount));
  if (!wouldHitBlocker()) return true;
  world.quaternion.copy(old);
  return false;
}

function tryMove(amount) {
  // Forward is permanently screen-up. If a landmark is ahead, ease along either shoulder rather than
  // pinning the player against its collision boundary.
  if (tryMoveAt(0, amount)) return true;
  const shoulder = Math.sign(amount) * 0.72;
  return tryMoveAt(shoulder, amount) || tryMoveAt(-shoulder, amount) || tryMoveAt(shoulder * 1.75, amount) || tryMoveAt(-shoulder * 1.75, amount);
}

export function updatePlayer(dt, t) {
  const { forward, turn } = moveIntent();

  // Steering rotates the planet itself, so the explorer never turns away from their forward course.
  const turnRate = 1.55 * tuning.turnSpeed;
  if (turn) world.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), turnRate * turn * dt));

  // Backing up is slower than walking forward. The joystick scales speed by how far it's pushed.
  const walking = forward !== 0;
  const speed = 1.05 * tuning.walkSpeed;
  if (forward > 0) tryMove(-speed * forward * dt);
  if (forward < 0) tryMove(speed * 0.65 * -forward * dt);

  // With no legs, the snowman waddles side to side and its arms bob while it walks.
  const swing = walking ? Math.sin(t * 0.014) : 0;
  avatar.rotation.z = swing * 0.12;
  arms.forEach((arm, i) => { arm.rotation.x = swing * 0.3 * (i ? 1 : -1); });
}
