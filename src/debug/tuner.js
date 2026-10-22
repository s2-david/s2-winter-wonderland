import { tuning } from '../config.js';

// Temporary creative controls, only built when the page is opened with ?debug.
const controls = [
  { key: 'walkSpeed', label: 'Walk speed', min: 0.2, max: 2, step: 0.01, format: v => `${v.toFixed(2)}×` },
  { key: 'turnSpeed', label: 'Turn speed', min: 0.2, max: 2, step: 0.01, format: v => `${v.toFixed(2)}×` },
  { key: 'heroHeight', label: 'Hero height', min: 0, max: 0.6, step: 0.01, format: v => v.toFixed(2) },
  { key: 'snowDensity', label: 'Snow density', min: 0, max: 100, step: 1, format: v => `${v}%` },
  { key: 'snowSize', label: 'Snow size', min: 0.03, max: 0.24, step: 0.005, format: v => v.toFixed(2) },
  { key: 'snowSpeed', label: 'Snow speed', min: 0.2, max: 3.5, step: 0.05, format: v => v.toFixed(2) },
];

export function mountTuner(onChange) {
  const settings = document.querySelector('#settings');
  const tune = document.createElement('button');
  tune.id = 'tune';
  tune.type = 'button';
  tune.setAttribute('aria-expanded', 'false');
  tune.setAttribute('aria-controls', 'tuner');
  tune.textContent = '☷ Tune scene';
  settings.prepend(tune);

  const tuner = document.createElement('aside');
  tuner.id = 'tuner';
  tuner.setAttribute('aria-label', 'Prototype scene tuning');
  tuner.innerHTML = '<h2>Prototype tuning</h2><p>Debug-only creative controls (?debug). Not shown to visitors.</p>';

  for (const { key, label, min, max, step, format } of controls) {
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
  settings.after(tuner);

  tune.addEventListener('click', () => {
    const open = tuner.classList.toggle('open');
    tune.setAttribute('aria-expanded', String(open));
  });
}
