import { stick } from '../input.js';

// Touch controls show on phones and tablets, and on any device as soon as it's touched.
const markTouch = () => document.body.classList.add('touch');
if (matchMedia('(pointer: coarse)').matches) markTouch();
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') markTouch(); });

const joystick = document.querySelector('#joystick');
const knob = joystick.querySelector('.knob');
const DEADZONE = 0.15;
let activePointer = null;

function moveStick(e) {
  const rect = joystick.getBoundingClientRect();
  const radius = rect.width / 2;
  let dx = (e.clientX - rect.left - radius) / radius;
  let dy = (e.clientY - rect.top - radius) / radius;
  const length = Math.hypot(dx, dy);
  if (length > 1) { dx /= length; dy /= length; }
  knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
  // Screen-up is forward. Inside the deadzone the explorer stays put.
  stick.x = Math.abs(dx) < DEADZONE ? 0 : dx;
  stick.y = Math.abs(dy) < DEADZONE ? 0 : -dy;
  if (stick.x || stick.y) document.body.classList.add('moved');
}

function releaseStick() {
  activePointer = null;
  stick.x = stick.y = 0;
  knob.style.transform = '';
  joystick.classList.remove('active');
}

joystick.addEventListener('pointerdown', e => {
  activePointer = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  joystick.classList.add('active');
  moveStick(e);
});
joystick.addEventListener('pointermove', e => { if (e.pointerId === activePointer) moveStick(e); });
joystick.addEventListener('pointerup', e => { if (e.pointerId === activePointer) releaseStick(); });
joystick.addEventListener('pointercancel', e => { if (e.pointerId === activePointer) releaseStick(); });
