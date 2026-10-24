import * as THREE from 'three';
import { ZOOM } from './config.js';
import { camera, renderer, lights } from './stage.js';
import { moveIntent } from './input.js';

let zoom = ZOOM.start, targetZoom = ZOOM.start;

// Positive amounts pull back toward the planet view; negative amounts move in close.
export function zoomBy(amount) {
  targetZoom = THREE.MathUtils.clamp(targetZoom + amount, ZOOM.min, ZOOM.max);
}

renderer.domElement.addEventListener('wheel', e => zoomBy(e.deltaY * 0.014), { passive: true });

// Two-finger pinch on the scene zooms: spreading fingers moves in, pinching together pulls back.
const touches = new Map();
let pinchDistance = 0;
const fingerGap = () => {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) pinchDistance = fingerGap();
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size !== 2) return;
  const gap = fingerGap();
  zoomBy((pinchDistance - gap) * 0.06);
  pinchDistance = gap;
});
const endTouch = e => touches.delete(e.pointerId);
renderer.domElement.addEventListener('pointerup', endTouch);
renderer.domElement.addEventListener('pointercancel', endTouch);

export function toggleView() {
  targetZoom = targetZoom > 25 ? ZOOM.close : ZOOM.wide;
}

// Zoomed out, dragging with the mouse turns the planet to look it over. It's really the camera (and
// the lights with it) circling the planet's centre, so the world, and the explorer's place on it,
// stay put. Walking or zooming back in eases the view round to the explorer again.
const orbit = new THREE.Quaternion(), spin = new THREE.Quaternion(), home = new THREE.Quaternion();
const axis = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1);
const canOrbit = () => targetZoom >= ZOOM.orbit;
let drag = null, returning = false;

renderer.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button !== 0 || !canOrbit()) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  returning = false;
  renderer.domElement.setPointerCapture(e.pointerId);
  document.body.classList.add('orbiting');
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerId !== drag?.id || !canOrbit()) return;
  // Turn about the camera's own screen axes so the planet follows the pointer like a ball in the hand.
  const speed = 5 / innerHeight;
  spin.setFromAxisAngle(axis.set(0, 1, 0).applyQuaternion(camera.quaternion), -(e.clientX - drag.x) * speed);
  orbit.premultiply(spin);
  spin.setFromAxisAngle(axis.set(1, 0, 0).applyQuaternion(camera.quaternion), -(e.clientY - drag.y) * speed);
  orbit.premultiply(spin).normalize();
  drag.x = e.clientX;
  drag.y = e.clientY;
});
const endDrag = e => {
  if (e.pointerId !== drag?.id) return;
  drag = null;
  document.body.classList.remove('orbiting');
};
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
// A tap can be released before the next frame polls the keys, so catch the press itself.
addEventListener('keydown', e => { if (e.key.startsWith('Arrow') && !drag) returning = true; });

const closePos = new THREE.Vector3(0, 4.5, 12.2), closeFocus = new THREE.Vector3(0, -2, 9.8), planetCenter = new THREE.Vector3();
const widePos = new THREE.Vector3(), focus = new THREE.Vector3();

export function updateCamera() {
  // Once walking starts the return carries on by itself, so a quick tap of an arrow key is enough.
  const { forward, turn } = moveIntent();
  if ((forward || turn || !canOrbit()) && !drag) returning = true;
  if (returning) {
    orbit.slerp(home, 0.08);
    if (orbit.angleTo(home) < 0.001) { orbit.identity(); returning = false; }
  }
  document.body.classList.toggle('can-orbit', canOrbit());

  // Third-person framing lives on the surface's tangent: behind the explorer (positive Y), not above them
  // along the sphere's outward Z axis. The overview smoothly returns to the familiar whole-planet view.
  zoom = THREE.MathUtils.lerp(zoom, targetZoom, 0.08);
  const overview = THREE.MathUtils.clamp((zoom - 20) / 14, 0, 1);
  camera.position.lerpVectors(closePos, widePos.set(0, 4.7, zoom), overview);
  // The forward focal point stays on the near, exterior snow surface: camera → explorer → path,
  // avoiding a line that cuts through the globe.
  focus.lerpVectors(closeFocus, planetCenter, overview);
  camera.position.applyQuaternion(orbit);
  focus.applyQuaternion(orbit);
  camera.up.copy(UP).applyQuaternion(orbit);
  camera.lookAt(focus);
  lights.quaternion.copy(orbit);
}
