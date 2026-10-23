import * as THREE from 'three';
import { ZOOM } from './config.js';
import { camera, renderer } from './stage.js';

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

const closePos = new THREE.Vector3(0, 3.3, 11.5), closeFocus = new THREE.Vector3(0, -1.6, 9.9), planetCenter = new THREE.Vector3();
const widePos = new THREE.Vector3(), focus = new THREE.Vector3();

export function updateCamera() {
  // Third-person framing lives on the surface's tangent: behind the explorer (positive Y), not above them
  // along the sphere's outward Z axis. The overview smoothly returns to the familiar whole-planet view.
  zoom = THREE.MathUtils.lerp(zoom, targetZoom, 0.08);
  const overview = THREE.MathUtils.clamp((zoom - 20) / 14, 0, 1);
  camera.position.lerpVectors(closePos, widePos.set(0, 4.7, zoom), overview);
  // The forward focal point stays on the near, exterior snow surface: camera → explorer → path,
  // avoiding a line that cuts through the globe.
  focus.lerpVectors(closeFocus, planetCenter, overview);
  camera.lookAt(focus);
}
