// Currently held keys, by lowercase `KeyboardEvent.key` (e.g. "w", "arrowup").
export const keys = {};

const actions = {};

// Register a one-shot action for a key press. Held-key auto-repeat does not re-fire it.
export function onKey(key, fn) {
  actions[key] = fn;
}

addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  keys[key] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  if (!e.repeat) actions[key]?.();
});

addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

// A key released while the window is unfocused never sends keyup, which would leave the explorer walking.
addEventListener('blur', () => {
  for (const key in keys) keys[key] = false;
});
