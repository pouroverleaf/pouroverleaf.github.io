import { useEffect, useState } from 'react';

// Background music: one looping <audio> for the whole site, routed through a Web Audio analyser so
// the home logo can draw a visualizer. Browsers refuse to start audio before the visitor interacts,
// so start() is tried at load and again on the first click / tap / key press.
const SRC = encodeURI('/media/Persona 3 Portable Sun - RevolverJesusP3.mp3');
const KEY = 'pouroverleaf:sound'; // remembers "off" between visits

const audio = new Audio(SRC);
audio.loop = true;
audio.preload = 'auto';
audio.volume = 0.6;

let ctx = null, analyser = null;
let wanted = localStorage.getItem(KEY) !== 'off';
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(isPlaying()));
audio.addEventListener('play', emit);
audio.addEventListener('pause', emit);

function graph() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.78;
  ctx.createMediaElementSource(audio).connect(analyser);
  analyser.connect(ctx.destination);
}

export function isPlaying() { return !audio.paused; }
export function getAnalyser() { return isPlaying() ? analyser : null; }

export function start() {
  if (!wanted || isPlaying()) return;
  graph();
  ctx?.resume?.();
  audio.play().catch(() => {}); // blocked until a gesture; the listeners below retry
}

export function toggle() {
  wanted = !isPlaying();
  localStorage.setItem(KEY, wanted ? 'on' : 'off');
  if (wanted) start(); else audio.pause();
}

// Only play while the site is on screen: pause when the tab is hidden (switched away, minimised,
// screen locked) and pick up again on return if sound is on.
let pausedByHide = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pausedByHide = isPlaying();
    audio.pause();
  } else if (pausedByHide) {
    pausedByHide = false;
    start();
  }
});

// Try now, then on the first real interaction until it plays.
export function autostart() {
  if (document.hidden) pausedByHide = wanted; // opened in a background tab: start once it's shown
  else start();
  const kick = () => {
    start();
    if (isPlaying() || !wanted) ['pointerdown', 'keydown', 'touchend'].forEach((t) => removeEventListener(t, kick, true));
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((t) => addEventListener(t, kick, true));
}

export function usePlaying() {
  const [on, setOn] = useState(isPlaying());
  useEffect(() => { listeners.add(setOn); return () => listeners.delete(setOn); }, []);
  return on;
}
