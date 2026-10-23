import * as THREE from 'three';
import { R, tuning } from './config.js';
import { world, blockers } from './world/planet.js';
import { moveIntent } from './input.js';

// Explorer stays planted and always faces the forward screen direction while the planet moves underneath.
export const hero = new THREE.Group();
hero.position.set(0, 0, R);
hero.rotation.x = Math.PI / 2;

const avatar = new THREE.Group();
hero.add(avatar);

// The explorer is a snowman styled like a soft vinyl toy: smooth satin snowballs, a big head, glossy
// coal eyes, blush cheeks, a carrot nose, stick arms and a ribbed knit beanie and scarf.

// Painted once on a small canvas and shared by every snowball: soft blue-grey hollows and bright flecks
// read as packed snow without loading an image.
function snowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5fbff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Hollows are drawn three times across the seam so the texture wraps around the sphere cleanly.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * canvas.width, y = Math.random() * canvas.height, r = 4 + Math.random() * 10;
    for (const dx of [-canvas.width, 0, canvas.width]) {
      const hollow = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      hollow.addColorStop(0, 'rgba(183, 211, 221, 0.35)');
      hollow.addColorStop(1, 'rgba(183, 211, 221, 0)');
      ctx.fillStyle = hollow;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(150, 180, 205, 0.35)';
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1.5, 1.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Fine vertical ribs, used as both colour and bump, make the beanie and scarf read as soft knit.
function knitTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#7b9bd0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 4) {
    const rib = ctx.createLinearGradient(x, 0, x + 4, 0);
    rib.addColorStop(0, 'rgba(59, 85, 124, 0.45)');
    rib.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    rib.addColorStop(1, 'rgba(59, 85, 124, 0.45)');
    ctx.fillStyle = rib;
    ctx.fillRect(x, 0, 4, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Smooth shading and a satin finish give the soft vinyl-toy look; the snow texture stays as gentle colour only.
const snow = new THREE.MeshStandardMaterial({ map: snowTexture(), roughness: 0.55 });
const coal = new THREE.MeshStandardMaterial({ color: '#23232b', roughness: 0.2 });
const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const blush = new THREE.MeshStandardMaterial({ color: '#b7ddff', roughness: 0.6 });
const wood = new THREE.MeshStandardMaterial({ color: '#5f3b25', roughness: 0.7 });
const knitMap = knitTexture();
const knit = new THREE.MeshStandardMaterial({ map: knitMap, bumpMap: knitMap, bumpScale: 2, roughness: 0.85 });
const cuffMap = knitMap.clone();
cuffMap.repeat.set(4, 1);
const cuffKnit = new THREE.MeshStandardMaterial({ map: cuffMap, bumpMap: cuffMap, bumpScale: 2, roughness: 0.85 });

// A big, fat bottom snowball (squashed a little so it sits heavy), a big-to-medium middle and a
// medium head. Each snowball is its own group so it can sway separately; the face and arms ride along.
const HEAD = 0.17;
const snowballs = [[0.3, 0.27, 0.92], [0.22, 0.706, 1], [HEAD, 1.046, 1]].map(([radius, y, squash]) => {
  const ball = new THREE.Group();
  ball.position.y = y;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), snow);
  mesh.scale.y = squash;
  ball.add(mesh);
  avatar.add(ball);
  return ball;
});
const [, middle, head] = snowballs;

// The face and beanie are laid out for a head of radius 0.2 and scaled as one piece to fit the real head.
const face = new THREE.Group();
face.scale.setScalar(HEAD / 0.2);
head.add(face);

// Big glossy oval eyes, angled to follow the curve of the head, each with a small white highlight.
// The beanie's cuff sits just over their tops for a sleepy, deadpan look.
const eyeGeometry = new THREE.SphereGeometry(0.04, 16, 12);
const shineGeometry = new THREE.SphereGeometry(0.011, 8, 6);
const blushGeometry = new THREE.SphereGeometry(0.032, 16, 8);
for (const side of [-1, 1]) {
  const eye = new THREE.Mesh(eyeGeometry, coal);
  eye.scale.set(1, 1.25, 0.45);
  eye.position.set(side * 0.075, -0.005, 0.178);
  eye.rotation.y = side * 0.38;
  const highlight = new THREE.Mesh(shineGeometry, shine);
  highlight.position.set(side * 0.075 + 0.014, 0.018, 0.197);
  const cheek = new THREE.Mesh(blushGeometry, blush);
  cheek.scale.set(1, 1, 0.2);
  cheek.position.set(side * 0.12, -0.055, 0.148);
  cheek.rotation.y = side * 0.68;
  face.add(eye, highlight, cheek);
}

const nose = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#d68c58', roughness: 0.5 }));
nose.rotation.x = Math.PI / 2;
nose.position.set(0, -0.04, 0.25);
face.add(nose);

// A slouchy ribbed beanie: a low dome, a chunky rolled cuff and a snowy pom-pom.
const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.208, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), knit);
beanie.position.y = 0.07;
beanie.scale.y = 0.9;
const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.042, 12, 40), cuffKnit);
cuff.rotation.x = Math.PI / 2;
cuff.position.y = 0.08;
const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), snow);
pompom.position.y = 0.29;
face.add(beanie, cuff, pompom);

// Each arm pivots at the shoulder, so the geometry starts at its base rather than its middle.
const stickGeometry = new THREE.CylinderGeometry(0.016, 0.022, 0.34, 8).translate(0, 0.17, 0);
const twigGeometry = new THREE.CylinderGeometry(0.01, 0.014, 0.11, 6).translate(0, 0.055, 0);
const arms = [-1, 1].map((side) => {
  const arm = new THREE.Group();
  arm.position.set(side * 0.19, 0.04, 0);
  arm.rotation.z = -side * 1.05;
  const twig = new THREE.Mesh(twigGeometry, wood);
  twig.position.y = 0.23;
  twig.rotation.z = side * 0.7;
  arm.add(new THREE.Mesh(stickGeometry, wood), twig);
  middle.add(arm);
  return arm;
});

// A puffy knit scarf matches the beanie and wraps the neck where the head meets the middle snowball.
// Its knot and tail sit at the front, marking the explorer's fixed, forward-facing heading.
const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.045, 12, 32), cuffKnit);
wrap.rotation.x = Math.PI / 2;
wrap.position.y = 0.19;
const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), knit);
knot.position.set(0.04, 0.17, 0.15);
const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.12, 4, 12), knit);
tail.scale.z = 0.5;
tail.position.set(0.05, 0.08, 0.215);
tail.rotation.set(-0.3, 0, 0.15);
middle.add(wrap, knot, tail);

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
  avatar.rotation.z = swing * 0.06;
  // Each snowball lags the one below it, so the stack wobbles like loosely packed snow.
  snowballs.forEach((ball, i) => {
    const lag = walking ? Math.sin(t * 0.014 - i * 0.7) : 0;
    ball.position.x = lag * 0.015 * i;
    ball.rotation.z = lag * 0.1;
  });
  arms.forEach((arm, i) => { arm.rotation.x = swing * 0.3 * (i ? 1 : -1); });
}
