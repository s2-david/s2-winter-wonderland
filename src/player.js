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

const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 4, 8), new THREE.MeshStandardMaterial({ color: '#e9575b', flatShading: true }));
body.rotation.x = Math.PI / 2;
body.position.y = 0.35;
avatar.add(body);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshStandardMaterial({ color: '#f5c7a9', flatShading: true }));
head.position.y = 0.73;
avatar.add(head);

const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 8), new THREE.MeshStandardMaterial({ color: '#d83c47', flatShading: true }));
hat.position.y = 0.99;
avatar.add(hat);

const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#f4f8ff' }));
brim.position.y = 0.82;
avatar.add(brim);

const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.12), new THREE.MeshStandardMaterial({ color: '#3b557c' })), leg2 = leg1.clone();
leg1.position.set(-0.1, 0.1, 0);
leg2.position.set(0.1, 0.1, 0);
avatar.add(leg1, leg2);

// A bright scarf knot marks the explorer's fixed, forward-facing heading.
const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd260', flatShading: true }));
scarf.position.set(0, 0.62, 0.19);
avatar.add(scarf);

export function applyHeroTuning() {
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

  if (walking) {
    const swing = Math.sin(t * 0.014) * 0.55;
    leg1.rotation.x = swing;
    leg2.rotation.x = -swing;
  } else {
    leg1.rotation.x = leg2.rotation.x = 0;
  }
}
