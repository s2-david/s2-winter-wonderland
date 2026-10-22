// Currently held keys, by lowercase `KeyboardEvent.key` (e.g. "arrowup", "e").
export const keys = {};

// Analog stick from the on-screen joystick: x is steer (right +), y is travel (forward +), each -1..1.
export const stick = { x: 0, y: 0 };

const actions = {};

// Register a one-shot action for a key press. Held-key auto-repeat does not re-fire it.
export function onKey(key, fn) {
  actions[key] = fn;
}

// Combined keyboard + joystick intent: forward (+1 ahead, -1 back) and turn (+1 right, -1 left).
export function moveIntent() {
  const forward = (keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0) + stick.y;
  const turn = (keys.arrowright ? 1 : 0) - (keys.arrowleft ? 1 : 0) + stick.x;
  return { forward: Math.max(-1, Math.min(1, forward)), turn: Math.max(-1, Math.min(1, turn)) };
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
  stick.x = stick.y = 0;
});
