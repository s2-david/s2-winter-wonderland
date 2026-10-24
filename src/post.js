import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, SelectiveBloomEffect, TiltShiftEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, KernelSize, EffectAttribute,
} from 'postprocessing';
import { tuning } from './config.js';
import { scene, camera, renderer, blend } from './stage.js';

// Post-processing for the miniature-diorama look: glowing windows, a tilt-shift blur and a soft vignette,
// merged into one effect pass. Quality (`tuning.postQuality`): 0 renders straight to the screen as before,
// 1 drops the tilt-shift (the default on phones), 2 is everything.

// Phones start without tilt-shift; the tuning panel can still raise it.
if (matchMedia('(pointer: coarse)').matches) tuning.postQuality = Math.min(tuning.postQuality, 1);

// Half-float buffers keep the scene in HDR until the tone mapping effect, so bloom works on the real
// brightness. Rendering into a buffer skips the canvas's own antialiasing, so the buffer gets its own MSAA.
const composer = new EffectComposer(renderer, {
  frameBufferType: THREE.HalfFloatType,
  multisampling: Math.min(4, renderer.capabilities.maxSamples),
});
composer.addPass(new RenderPass(scene, camera));

// Only what's marked with glow() blooms, so bright snow in daylight never does. Without ignoreBackground
// the empty sky would count as selected too.
const bloom = new SelectiveBloomEffect(scene, camera, { mipmapBlur: true, luminanceThreshold: 0, radius: 0.7 });
bloom.ignoreBackground = true;
const tiltShift = new TiltShiftEffect({ feather: 0.3, kernelSize: KernelSize.MEDIUM });
// EffectPass sorts effects by these flags and would put bloom (which reads depth) first, so the blur would
// then wipe the glow out of focus. With the same flag the order given below is kept.
tiltShift.setAttributes(EffectAttribute.DEPTH);
// Tone mapping moves here from the materials: three.js skips it when rendering into a buffer.
const toneMapping = new ToneMappingEffect();
const vignette = new VignetteEffect({ offset: 0.3 });
const TONE_MAPPINGS = [ToneMappingMode.LINEAR, ToneMappingMode.ACES_FILMIC, ToneMappingMode.AGX];

// Adds an object (for example instanced window panes) to the bloom.
export function glow(object) {
  bloom.selection.add(object);
}

// Additive glow decals (the soft light around windows and on the snow) blend in linear light once the
// scene renders into a buffer, which makes them far stronger than on screen. Bloom does part of their job
// now, so they're turned down while post-processing is on.
const decals = [];
export function glowDecal(material, strength) {
  decals.push([material, strength]);
  material.color.setScalar(quality > 0 ? strength : 1);
}

let effects = null, quality = -1;
function setQuality(level) {
  quality = level;
  for (const [material, strength] of decals) material.color.setScalar(level > 0 ? strength : 1);
  if (effects) {
    composer.removePass(effects);
    effects.fullscreenMaterial.dispose(); // not effects.dispose(), which would dispose the shared effects
    effects = null;
  }
  if (level === 0) return;
  // Tilt-shift blurs the raw scene, so it goes first; bloom is added before tone mapping, in HDR.
  effects = new EffectPass(camera, ...(level > 1 ? [tiltShift] : []), bloom, toneMapping, vignette);
  composer.addPass(effects);
}

// Called once per frame. Bloom and vignette follow the daylight like the light tuning in stage.js.
export function renderFrame(dt) {
  if (tuning.postQuality !== quality) setQuality(tuning.postQuality);
  if (quality === 0) {
    renderer.render(scene, camera);
    return;
  }
  bloom.intensity = blend(tuning.bloom, tuning.dayBloom);
  vignette.darkness = blend(tuning.vignette, tuning.dayVignette);
  tiltShift.blendMode.opacity.value = tuning.tiltShift;
  tiltShift.focusArea = tuning.tiltFocus;
  // Changing the mode recompiles the pass, so only set it when it changes.
  if (toneMapping.mode !== TONE_MAPPINGS[tuning.toneMapping]) toneMapping.mode = TONE_MAPPINGS[tuning.toneMapping];
  composer.render(dt);
}

addEventListener('resize', () => composer.setSize(innerWidth, innerHeight));
