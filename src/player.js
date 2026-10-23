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

const snowMap = snowTexture();
const snow = new THREE.MeshStandardMaterial({ map: snowMap, bumpMap: snowMap, bumpScale: 1, roughness: 0.9 });
const coal = new THREE.MeshStandardMaterial({ color: '#23232b', flatShading: true });
const wood = new THREE.MeshStandardMaterial({ color: '#5f3b25', flatShading: true });

// Each snowball is its own group so it can sway separately; the face and arms ride along with theirs.
const snowballs = [[0.24, 0.22], [0.18, 0.56], [0.14, 0.82]].map(([radius, y]) => {
  const ball = new THREE.Group();
  ball.position.y = y;
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), snow));
  avatar.add(ball);
  return ball;
});
const [, middle, head] = snowballs;

const eyeGeometry = new THREE.SphereGeometry(0.026, 6, 4);
for (const x of [-0.05, 0.05]) {
  const eye = new THREE.Mesh(eyeGeometry, coal);
  eye.position.set(x, 0.03, 0.125);
  head.add(eye);
}

const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.15, 6), new THREE.MeshStandardMaterial({ color: '#d68c58', flatShading: true }));
nose.rotation.x = Math.PI / 2;
nose.position.set(0, -0.01, 0.2);
head.add(nose);

// A blue knit beanie: a tall dome over the top of the head, a darker folded band and a snowy pom-pom.
const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#7b9bd0', flatShading: true }));
beanie.position.y = 0.07;
beanie.scale.y = 1.15;
const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.045, 16), new THREE.MeshStandardMaterial({ color: '#3b557c', flatShading: true }));
band.position.y = 0.075;
const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), snow);
pompom.position.y = 0.25;
head.add(beanie, band, pompom);

// Each arm pivots at the shoulder, so the geometry starts at its base rather than its middle.
const stickGeometry = new THREE.CylinderGeometry(0.012, 0.018, 0.34, 5).translate(0, 0.17, 0);
const twigGeometry = new THREE.CylinderGeometry(0.008, 0.012, 0.12, 4).translate(0, 0.06, 0);
const arms = [-1, 1].map((side) => {
  const arm = new THREE.Group();
  arm.position.set(side * 0.15, 0.04, 0);
  arm.rotation.z = -side * 1.05;
  const twig = new THREE.Mesh(twigGeometry, wood);
  twig.position.y = 0.22;
  twig.rotation.z = side * 0.7;
  arm.add(new THREE.Mesh(stickGeometry, wood), twig);
  middle.add(arm);
  return arm;
});

// The scarf matches the beanie and wraps the neck where the head meets the middle snowball. Its knot
// and tail sit at the front, marking the explorer's fixed, forward-facing heading.
const scarfMaterial = new THREE.MeshStandardMaterial({ color: '#7b9bd0', flatShading: true });
const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 16), scarfMaterial);
wrap.rotation.x = Math.PI / 2;
wrap.position.y = 0.15;
const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), scarfMaterial);
knot.position.set(0, 0.14, 0.13);
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.02), scarfMaterial);
tail.position.set(0.03, 0.05, 0.18);
tail.rotation.set(-0.25, 0, 0.2);
middle.add(wrap, knot, tail);

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
  avatar.rotation.z = swing * 0.06;
  // Each snowball lags the one below it, so the stack wobbles like loosely packed snow.
  snowballs.forEach((ball, i) => {
    const lag = walking ? Math.sin(t * 0.014 - i * 0.7) : 0;
    ball.position.x = lag * 0.015 * i;
    ball.rotation.z = lag * 0.1;
  });
  arms.forEach((arm, i) => { arm.rotation.x = swing * 0.3 * (i ? 1 : -1); });
}
