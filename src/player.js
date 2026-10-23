import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { R, tuning } from './config.js';
import { world, blockers, snowHeight } from './world/planet.js';
import { moveIntent } from './input.js';
import { addGrain } from './grain.js';
import snowmanUrl from './world/models/snowman.glb?url';

// Explorer stays planted while the planet moves underneath; forward is always screen-up.
export const hero = new THREE.Group();
hero.position.set(0, 0, R);
hero.rotation.x = Math.PI / 2;

// Standing still, the snowman turns round to face the camera behind it so its face is in view.
// updatePlayer() swings it back to face screen-up while it walks forward.
const FACE_CAMERA = Math.PI;
const avatar = new THREE.Group();
avatar.rotation.y = FACE_CAMERA;
hero.add(avatar);

// The explorer is a papercraft snowman: two low-poly snowballs folded from matte card, each facet a
// slightly different tone, with a black top hat trimmed in holly, a red scarf and coal buttons. It's
// modelled in Blender (art/blender/snowman.py) with the tones and soft occlusion baked into vertex
// colours, and every part shares one matte card material here.
const card = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });

// The parts updatePlayer() animates. Each snowball can sway separately; the face, hat, scarf and arms
// ride along. They stay empty until the model has loaded.
let snowballs = [], arms = [], eyes = [], cheeks = [], head = null, smile = null;

new GLTFLoader().load(snowmanUrl, ({ scene: model }) => {
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = card;
    o.castShadow = o.receiveShadow = o.name.endsWith('Snow');
  });
  const part = (name) => model.getObjectByName(name);
  head = part('Head');
  snowballs = [part('Body'), head];
  arms = [part('Arm0'), part('Arm1')];
  eyes = [part('Eye0'), part('Eye1')];
  cheeks = [part('Cheek0'), part('Cheek1')];
  for (const cheek of cheeks) cheek.userData.y = cheek.position.y;
  smile = part('Smile');
  for (const ball of snowballs) avatar.add(ball);
  // Loaded after main.js added grain to the hero, so the snowman adds its own.
  addGrain(avatar, { onPlanet: false });
});

export function applyHeroTuning() {
  avatar.scale.setScalar(tuning.heroScale);
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

const underfoot = new THREE.Vector3(), undo = new THREE.Quaternion();
let motion = 0; // forward intent, eased so the scoot starts and stops smoothly

export function updatePlayer(dt, t) {
  const { forward, turn } = moveIntent();

  // Steering rotates the planet itself, so the explorer never turns away from their forward course.
  const turnRate = 1.55 * tuning.turnSpeed;
  if (turn) world.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), turnRate * turn * dt));

  // Backing up is slower than walking forward. The joystick scales speed by how far it's pushed.
  const speed = 1.05 * tuning.walkSpeed;
  if (forward > 0) tryMove(-speed * forward * dt);
  if (forward < 0) tryMove(speed * 0.65 * -forward * dt);

  // Ride up and over the snow drifts underfoot.
  underfoot.set(0, 0, 1).applyQuaternion(undo.copy(world.quaternion).invert());
  hero.position.z = R + snowHeight(underfoot);

  // Face where it's going: away from the camera when walking forward, towards it when backing up or
  // standing still. Easing makes the turn a quick spin rather than a snap.
  const facing = forward > 0 ? 0 : FACE_CAMERA;
  avatar.rotation.y += (facing - avatar.rotation.y) * (1 - Math.exp(-10 * dt));

  // With no legs, the snowman scoots: it leans into the direction it's travelling and pushes along in
  // small hops, with just a little side-to-side wobble. Easing the motion in and out lets it settle
  // when it stops instead of freezing mid-hop.
  motion += (forward - motion) * (1 - Math.exp(-8 * dt));
  const gait = Math.abs(motion);
  const phase = t * 0.011;
  const hop = Math.abs(Math.sin(phase)) * gait;
  avatar.position.y = hop * 0.035;
  avatar.rotation.x = motion * (0.06 + hop * 0.06);
  const sway = Math.sin(phase) * gait;
  avatar.rotation.z = sway * 0.025;
  // The head lags the body a touch, so the stack still reads as loosely packed snow.
  snowballs.forEach((ball, i) => {
    const lag = Math.sin(phase - i * 0.7) * gait;
    ball.position.x = lag * 0.006 * i;
    ball.rotation.z = lag * 0.04;
  });
  arms.forEach((arm, i) => { arm.rotation.x = sway * 0.15 * (i ? 1 : -1); });

  // Scooting toward the camera, the snowman looks up at it and beams: the head tips back, the eyes
  // squint happily, the cheeks lift and the smile deepens.
  const joy = Math.min(1, Math.max(0, -motion));
  if (head) head.rotation.x = -0.3 * joy;
  for (const eye of eyes) eye.scale.y = 1 - 0.6 * joy;
  for (const cheek of cheeks) cheek.position.y = cheek.userData.y + 0.012 * joy;
  if (smile) smile.morphTargetInfluences[0] = joy;
}
