let muted = false;
let ctx;

export function setMuted(value) {
  muted = value;
}

// The jingle is synthesized in-browser; no audio files needed. One AudioContext is reused because
// browsers cap how many a page may create.
export function jingle() {
  if (muted) return;
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime;
  [880, 1175, 1568].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.12 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.55);
    o.start(t + i * 0.12);
    o.stop(t + i * 0.12 + 0.58);
  });
}
