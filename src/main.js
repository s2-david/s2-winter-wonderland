import './styles.css';
import { BELL_RANGE, SHOW_TUNER } from './config.js';
import { scene, applyLightTuning } from './stage.js';
import { renderFrame } from './post.js';
import { world } from './world/planet.js';
import { buildVillage } from './world/village.js';
import { placeBell, swingBell, updateBell, distanceToBell } from './world/bell.js';
import { hero, applyHeroTuning, updatePlayer } from './player.js';
import { toggleView, updateCamera } from './cameraRig.js';
import { snow, applySnowTuning, updateSnow } from './snow.js';
import { jingle } from './audio.js';
import { addGrain, applyGrainTuning, updateGrain } from './grain.js';
import { updateDaylight } from './daylight.js';
import { onKey } from './input.js';
import { showBellPrompt, showToast, onBellButton } from './ui/hud.js';
import './ui/touch.js';

scene.add(world);
buildVillage();
placeBell();
scene.add(hero);
scene.add(snow);
addGrain(world);
addGrain(hero, { onPlanet: false });

function applyTuning() {
  applySnowTuning();
  applyHeroTuning();
  applyGrainTuning();
  applyLightTuning();
}
applyTuning();

if (SHOW_TUNER || new URLSearchParams(location.search).has('debug')) {
  import('./debug/tuner.js').then(({ mountTuner }) => mountTuner(applyTuning));
}

const bellIsNear = () => distanceToBell(hero.position) < BELL_RANGE;

function ringBell() {
  if (!bellIsNear()) return;
  swingBell();
  jingle();
  showToast();
}

onKey('z', toggleView);
onKey('e', ringBell);
onBellButton(ringBell);

let elapsed = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - elapsed) / 1000 || 0.016);
  elapsed = t;
  updatePlayer(dt, t);
  updateDaylight();
  updateCamera();
  updateSnow(dt);
  updateBell(dt);
  updateGrain();
  showBellPrompt(bellIsNear());
  renderFrame(dt);
}
requestAnimationFrame(loop);
