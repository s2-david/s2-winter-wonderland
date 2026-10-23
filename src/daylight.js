import * as THREE from 'three';
import { tuning } from './config.js';
import { world } from './world/planet.js';
import { setDaylight } from './stage.js';

// The village keeps its night; walking toward the far side of the planet brings the day up.
// The explorer stands at +Z, which is also where the village starts, so the angle between that
// direction and the explorer's spot in the planet's own frame is how far they've walked.
const UP = new THREE.Vector3(0, 0, 1);
const here = new THREE.Vector3(), undo = new THREE.Quaternion();

export function updateDaylight() {
  here.copy(UP).applyQuaternion(undo.copy(world.quaternion).invert());
  const walked = THREE.MathUtils.radToDeg(here.angleTo(UP));
  setDaylight(THREE.MathUtils.smoothstep(walked, tuning.dawnStart, tuning.dawnEnd));
}
