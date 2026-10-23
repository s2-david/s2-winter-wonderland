import { tuning } from '../config.js';

// Creative tuning controls. Shown to everyone while SHOW_TUNER is on in config.js, otherwise only with ?debug.
const controls = [
  { heading: 'Explorer and snow' },
  { key: 'walkSpeed', label: 'Walk speed', min: 0.2, max: 2, step: 0.01, format: v => `${v.toFixed(2)}×` },
  { key: 'turnSpeed', label: 'Turn speed', min: 0.1, max: 2, step: 0.01, format: v => `${v.toFixed(2)}×` },
  { key: 'heroScale', label: 'Hero size', min: 0.2, max: 1.2, step: 0.01, format: v => `${v.toFixed(2)}×` },
  { key: 'snowDensity', label: 'Snow density', min: 0, max: 100, step: 1, format: v => `${v}%` },
  { key: 'snowSize', label: 'Snow size', min: 0.03, max: 0.24, step: 0.005, format: v => v.toFixed(3) },
  { key: 'snowSpeed', label: 'Snow speed', min: 0.2, max: 3.5, step: 0.05, format: v => v.toFixed(2) },
  { key: 'snowJitter', label: 'Snow flutter', min: 0, max: 0.2, step: 0.005, format: v => v.toFixed(3) },
  { key: 'snowInertia', label: 'Snow inertia', min: 0, max: 3, step: 0.05, format: v => `${v.toFixed(2)}s` },
  { heading: 'Paper' },
  { key: 'grain', label: 'Grain', min: 0, max: 2.5, step: 0.05, format: v => `${v.toFixed(2)}×` },
  { key: 'grainBlotch', label: 'Blotches', min: 0, max: 2, step: 0.05, format: v => `${v.toFixed(2)}×` },
  { key: 'grainSize', label: 'Grain size', min: 0.3, max: 3, step: 0.05, format: v => `${v.toFixed(2)}×` },
  { key: 'grainFibre', label: 'Fibres', min: 0, max: 2, step: 0.05, format: v => `${v.toFixed(2)}×` },
  { key: 'grainRelief', label: 'Relief', min: 0, max: 3, step: 0.05, format: v => `${v.toFixed(2)}×` },
  { heading: 'Light' },
  { key: 'sunStrength', label: 'Sun', min: 0, max: 6, step: 0.05, format: v => v.toFixed(2) },
  { key: 'sunHeight', label: 'Sun height', min: 5, max: 85, step: 1, format: v => `${v}°` },
  { key: 'sunAngle', label: 'Sun direction', min: -180, max: 180, step: 1, format: v => `${v}°` },
  { key: 'shadowSoftness', label: 'Shadow blur', min: 0, max: 8, step: 0.1, format: v => v.toFixed(1) },
  { key: 'skyFill', label: 'Sky fill', min: 0, max: 5, step: 0.05, format: v => v.toFixed(2) },
  { key: 'skyWarmth', label: 'Sky warmth', min: 0, max: 1, step: 0.01, format: v => v.toFixed(2) },
  { key: 'moonStrength', label: 'Moon', min: 0, max: 3, step: 0.05, format: v => v.toFixed(2) },
  { key: 'exposure', label: 'Exposure', min: 0.3, max: 2.5, step: 0.01, format: v => v.toFixed(2) },
  { key: 'toneMapping', label: 'Tone map', min: 0, max: 2, step: 1, format: v => ['None', 'ACES', 'AgX'][v] },
  { heading: 'Day (far side of the planet)' },
  { key: 'dawnStart', label: 'Dawn starts', min: 0, max: 180, step: 1, format: v => `${v}°` },
  { key: 'dawnEnd', label: 'Full day', min: 0, max: 180, step: 1, format: v => `${v}°` },
  { key: 'daySunStrength', label: 'Sun', min: 0, max: 6, step: 0.05, format: v => v.toFixed(2) },
  { key: 'daySunHeight', label: 'Sun height', min: 5, max: 85, step: 1, format: v => `${v}°` },
  { key: 'daySkyFill', label: 'Sky fill', min: 0, max: 5, step: 0.05, format: v => v.toFixed(2) },
  { key: 'daySkyWarmth', label: 'Sky warmth', min: 0, max: 1, step: 0.01, format: v => v.toFixed(2) },
  { key: 'dayMoonStrength', label: 'Moon', min: 0, max: 3, step: 0.05, format: v => v.toFixed(2) },
  { key: 'dayExposure', label: 'Exposure', min: 0.3, max: 2.5, step: 0.01, format: v => v.toFixed(2) },
];

// Lucide "sliders-horizontal" icon (ISC license, lucide.dev)
const SLIDERS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H3" /><path d="M12 19H3" /><path d="M14 3v4" /><path d="M16 17v4" /><path d="M21 12h-9" /><path d="M21 19h-5" /><path d="M21 5h-7" /><path d="M8 10v4" /><path d="M8 12H3" /></svg>';

export function mountTuner(onChange) {
  const settings = document.querySelector('#settings');
  const tune = document.createElement('button');
  tune.id = 'tune';
  tune.className = 'icon-button';
  tune.type = 'button';
  tune.title = 'Tune scene';
  tune.setAttribute('aria-label', 'Tune scene');
  tune.setAttribute('aria-expanded', 'false');
  tune.setAttribute('aria-controls', 'tuner');
  tune.innerHTML = SLIDERS_ICON;
  settings.prepend(tune);

  const tuner = document.createElement('aside');
  tuner.id = 'tuner';
  tuner.setAttribute('aria-label', 'Scene tuning');
  tuner.innerHTML = '<h2>Scene tuning</h2><p>Adjust, then copy the values to make them the new defaults.</p>';

  for (const { heading, key, label, min, max, step, format } of controls) {
    if (heading) {
      const h = document.createElement('h3');
      h.textContent = heading;
      tuner.append(h);
      continue;
    }
    const row = document.createElement('label');
    row.className = 'tune-row';
    row.htmlFor = key;
    row.innerHTML = `<span>${label}</span><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${tuning[key]}" /><output class="tune-value"></output>`;
    const input = row.querySelector('input'), output = row.querySelector('output');
    output.textContent = format(tuning[key]);
    input.addEventListener('input', () => {
      tuning[key] = Number(input.value);
      output.textContent = format(tuning[key]);
      onChange();
    });
    tuner.append(row);
  }

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'tune-copy';
  copy.textContent = 'Copy values';
  copy.addEventListener('click', async () => {
    const text = JSON.stringify(tuning, null, 2);
    console.log('Scene tuning values:', text);
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied ✓';
    } catch {
      copy.textContent = 'Copy failed: values are in the console';
    }
    setTimeout(() => { copy.textContent = 'Copy values'; }, 2000);
  });
  tuner.append(copy);
  settings.after(tuner);

  tune.addEventListener('click', () => {
    const open = tuner.classList.toggle('open');
    tune.setAttribute('aria-expanded', String(open));
  });
}
