import { setMuted } from '../audio.js';
import { toggleView } from '../cameraRig.js';

const prompt = document.querySelector('#prompt');
const toast = document.querySelector('#toast');
const view = document.querySelector('#view');
const mute = document.querySelector('#mute');

let muted = false;
mute.addEventListener('click', () => {
  muted = !muted;
  setMuted(muted);
  mute.setAttribute('aria-pressed', String(muted));
  mute.textContent = muted ? '◌ Sound off' : '♪ Sound on';
});

view.addEventListener('click', toggleView);

export function showBellPrompt(show) {
  prompt.classList.toggle('show', show);
}

export function showToast() {
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1900);
}
