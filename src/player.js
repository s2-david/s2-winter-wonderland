import * as THREE from 'three';
import { R, tuning } from './config.js';
import { world, blockers, snowHeight } from './world/planet.js';
import { moveIntent } from './input.js';

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
// slightly different tone, with a black top hat trimmed in holly, a red scarf and coal buttons.

// Bakes one colour into a geometry's vertices, nudging the tone of every triangle so flat-shaded
// facets read like separate folds of paper. Everything then shares one matte material.
function facets(geometry, color, spread = 0.06) {
  const folded = geometry.index ? geometry.toNonIndexed() : geometry;
  const base = new THREE.Color(color), tone = new THREE.Color();
  const count = folded.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    tone.copy(base).offsetHSL(0, 0, (Math.random() - 0.5) * spread);
    for (let j = 0; j < 3; j++) tone.toArray(colors, (i + j) * 3);
  }
  folded.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return folded;
}

const card = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
const SNOW = '#fbf9f4', COAL = '#2e2a2b', CHEEK = '#f2a383', CARROT = '#f28a1e', WOOD = '#7a4a2c';
const WOOL = '#d8403a', HAT = '#3a3536', HOLLY = '#4c8a3f';

// A big, fat body (squashed a little so it sits heavy) and a smaller head. Each snowball is its own
// group so it can sway separately; the face, hat, scarf and arms ride along.
const BODY = 0.36, SQUASH = 0.92, HEAD = 0.22;

// The body is pressed into the ground like a pear: widest low down, with its base flattened where it
// sits in the snow. bodyWidth() is how far the sides bulge at a height (as a fraction of the radius),
// so buttons and the scarf tail can sit on the surface.
const BASE = -0.66;
const bodyWidth = (height) => 1 + 0.07 * (1 - height);
function bodyGeometry() {
  const geometry = new THREE.IcosahedronGeometry(BODY, 2);
  const position = geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const height = v.y / BODY, bulge = bodyWidth(height);
    position.setXYZ(i, v.x * bulge, Math.max(height, BASE) * BODY, v.z * bulge);
  }
  return geometry;
}

const snowballs = [[bodyGeometry(), 0.21, SQUASH], [new THREE.IcosahedronGeometry(HEAD, 2), 0.72, 1]].map(([geometry, y, squash]) => {
  const ball = new THREE.Group();
  ball.position.y = y;
  const mesh = new THREE.Mesh(facets(geometry, SNOW, 0.05), card);
  mesh.scale.y = squash;
  ball.add(mesh);
  avatar.add(ball);
  return ball;
});
const [body, head] = snowballs;

// The face and hat are laid out for a head of radius 0.2 and scaled as one piece to fit the real head.
const face = new THREE.Group();
face.scale.setScalar(HEAD / 0.2);
head.add(face);

// Small coal eyes, hexagonal paper blush and a coal smile that bends with the cheeks.
const eyeGeometry = facets(new THREE.IcosahedronGeometry(0.024, 0), COAL, 0.05);
const blushGeometry = facets(new THREE.CircleGeometry(0.03, 6), CHEEK, 0.04);
for (const side of [-1, 1]) {
  const eye = new THREE.Mesh(eyeGeometry, card);
  eye.scale.z = 0.5;
  eye.position.set(side * 0.068, 0.045, 0.188);
  eye.rotation.y = side * 0.35;
  const cheek = new THREE.Mesh(blushGeometry, card);
  cheek.position.set(side * 0.125, -0.025, 0.155);
  cheek.rotation.y = side * 0.7;
  face.add(eye, cheek);
}
const SMILE = Math.PI * 0.55;
const smile = new THREE.Mesh(facets(new THREE.TorusGeometry(0.075, 0.009, 3, 9, SMILE), COAL, 0.05), card);
smile.position.set(0, -0.015, 0.205);
smile.rotation.set(0.4, 0, -Math.PI / 2 - SMILE / 2);
face.add(smile);

// A five-sided carrot, pointing a little to one side so its folds catch the light.
const nose = new THREE.Mesh(facets(new THREE.ConeGeometry(0.03, 0.14, 5), CARROT, 0.1), card);
nose.rotation.set(Math.PI / 2, 0, -0.35);
nose.position.set(0.02, 0.0, 0.25);
face.add(nose);

// A tall, slightly tipped top hat: an eight-sided crown on a wide brim, with a red band and a sprig of
// holly (two leaves and three berries) on the front.
const hat = new THREE.Group();
hat.position.set(0, 0.11, 0);
hat.rotation.set(-0.08, 0, 0.12);
const brim = new THREE.Mesh(facets(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 10), HAT, 0.06), card);
const crown = new THREE.Mesh(facets(new THREE.CylinderGeometry(0.15, 0.165, 0.24, 8), HAT, 0.08), card);
crown.position.y = 0.13;
const band = new THREE.Mesh(facets(new THREE.CylinderGeometry(0.168, 0.17, 0.055, 8), WOOL, 0.08), card);
band.position.y = 0.045;
hat.add(brim, crown, band);
const leafGeometry = facets(new THREE.OctahedronGeometry(0.035), HOLLY, 0.12);
for (const side of [-1, 1]) {
  const leaf = new THREE.Mesh(leafGeometry, card);
  leaf.scale.set(0.55, 1.4, 0.25);
  leaf.position.set(-0.08 + side * 0.03, 0.09, 0.15);
  leaf.rotation.set(-0.3, 0, side * 0.7);
  hat.add(leaf);
}
const berryGeometry = facets(new THREE.IcosahedronGeometry(0.017, 0), '#c8282b', 0.1);
for (const [x, y] of [[-0.095, 0.05], [-0.07, 0.045], [-0.083, 0.068]]) {
  const berry = new THREE.Mesh(berryGeometry, card);
  berry.position.set(x, y, 0.17);
  hat.add(berry);
}
face.add(hat);

// Three coal buttons down the front of the body, each turned to lie flat on its curve.
const buttonGeometry = facets(new THREE.IcosahedronGeometry(0.032, 0), COAL, 0.06);
for (const y of [0.14, 0.02, -0.1]) {
  const lift = Math.asin(y / SQUASH / BODY);
  const button = new THREE.Mesh(buttonGeometry, card);
  button.scale.z = 0.45;
  button.position.set(0.04, y, BODY * Math.cos(lift) * bodyWidth(Math.sin(lift)) - 0.005);
  button.rotation.set(-lift, 0.1, 0);
  body.add(button);
}

// Each arm pivots at the shoulder, so the geometry starts at its base rather than its middle. The
// arms reach up and out, forking into twigs near the top. Five-sided sticks keep them as folded card.
const stickGeometry = facets(new THREE.CylinderGeometry(0.016, 0.024, 0.36, 5).translate(0, 0.18, 0), WOOD, 0.08);
const twigGeometry = facets(new THREE.CylinderGeometry(0.009, 0.014, 0.11, 4).translate(0, 0.055, 0), WOOD, 0.08);
const arms = [-1, 1].map((side) => {
  const arm = new THREE.Group();
  arm.position.set(side * 0.3, 0.1, 0);
  arm.rotation.z = -side * 0.62;
  for (const [y, bend] of [[0.24, 0.7], [0.3, -0.55]]) {
    const twig = new THREE.Mesh(twigGeometry, card);
    twig.position.y = y;
    twig.rotation.z = side * bend;
    arm.add(twig);
  }
  arm.add(new THREE.Mesh(stickGeometry, card));
  body.add(arm);
  return arm;
});

// A red scarf wraps the neck where the head meets the body, with one flat paper tail hanging down the
// front of the body.
const wrap = new THREE.Mesh(facets(new THREE.TorusGeometry(0.17, 0.05, 4, 12), WOOL, 0.1), card);
wrap.rotation.x = Math.PI / 2;
wrap.position.y = 0.29;
body.add(wrap);
// The tail is two flat panels folded at the middle so it lies along the curve of the body.
for (const [y, z, length, tilt] of [[0.215, 0.28, 0.17, 0.74], [0.08, 0.375, 0.16, 0.26]]) {
  const panel = new THREE.Mesh(facets(new THREE.BoxGeometry(0.095, length, 0.02), WOOL, 0.1), card);
  panel.position.set(-0.07, y, z);
  panel.rotation.set(-tilt, -0.2, 0);
  body.add(panel);
}

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
}
