import * as THREE from 'three';
import { ZOOM } from './config.js';
import { camera, renderer } from './stage.js';

let zoom = ZOOM.start, targetZoom = ZOOM.start;

renderer.domElement.addEventListener('wheel', e => {
  targetZoom = THREE.MathUtils.clamp(targetZoom + e.deltaY * 0.014, ZOOM.min, ZOOM.max);
}, { passive: true });

export function toggleView() {
  targetZoom = targetZoom > 25 ? ZOOM.close : ZOOM.wide;
}

const closePos = new THREE.Vector3(0, 4.5, 12.2), closeFocus = new THREE.Vector3(0, -2, 9.8), planetCenter = new THREE.Vector3();
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
