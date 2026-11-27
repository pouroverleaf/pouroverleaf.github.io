import { useEffect, useState } from 'react';

// The site's music: the club playlist as a Spotify embed, driven through Spotify's iFrame API so the
// site knows when it is playing. It starts on the first click / tap / key press (browsers block
// sound before that), pauses while the tab is hidden, and stays off on later visits once paused.
// The embed's audio is sealed inside Spotify's iframe (no Web Audio access, and Spotify no longer
// offers audio analysis), so the visualizer can't hear it: `simulatedLevels` drives the bars with a
// made-up beat while it plays.
const URI = 'spotify:playlist:6SuOihuTSFAPIH5sPyxo7z';
const API = 'https://open.spotify.com/embed/iframe-api/v1';
const KEY = 'pouroverleaf:playlist'; // remembers "off" between visits

let controller = null;
let playing = false;
let positionMs = 0, positionAt = 0;
const listeners = new Set();
let wanted = localStorage.getItem(KEY) !== 'off';
const emit = () => listeners.forEach((fn) => fn(playing));

let apiReady = null;
function loadApi() {
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    const s = document.createElement('script');
    s.src = API;
    s.async = true;
    document.head.appendChild(s);
  });
  return apiReady;
}

// Mount the embed into `host` (a container React owns; the iframe goes in a child it doesn't).
export function mountSpotify(host, { width = '100%', height = 80 } = {}) {
  const slot = document.createElement('div');
  host.appendChild(slot);
  let dead = false;
  loadApi().then((IFrameAPI) => {
    if (dead) return;
    IFrameAPI.createController(slot, { uri: URI, width, height }, (c) => {
      controller = c;
      // Autoplay: try as soon as the embed is ready. Browsers allow it if the visitor has already
      // interacted with the page (or the site has earned autoplay); otherwise it stays paused and
      // autostart()'s first-interaction fallback starts it.
      c.addListener('ready', () => { if (wanted && !document.hidden) tryPlay(); });
      c.addListener('playback_update', (e) => {
        const now = !e.data.isPaused && !e.data.isBuffering;
        positionMs = e.data.position;
        positionAt = performance.now();
        if (now !== playing) {
          playing = now;
          emit();
        }
      });
    });
  });
  return () => { dead = true; controller?.destroy?.(); controller = null; playing = false; host.replaceChildren(); emit(); };
}

export function spotifyPositionMs() {
  return positionMs + (playing ? performance.now() - positionAt : 0);
}

export function isSpotifyPlaying() { return playing; }
// The embed hides its own play button at the nav column's width, so the nav has one of ours.
export function toggleSpotify() {
  wanted = !playing;
  localStorage.setItem(KEY, wanted ? 'on' : 'off');
  controller?.togglePlay();
}

// Ask the embed to play; playback_update confirms whether it did.
function tryPlay() {
  if (!playing) controller?.play();
}

// Fallback for blocked autoplay: start on the first interaction, unless the visitor turned it off.
export function autostart() {
  const events = ['pointerdown', 'keydown', 'touchend'];
  const stop = () => events.forEach((t) => removeEventListener(t, kick, true));
  function kick() {
    if (!wanted || playing) return stop();
    if (!controller) return; // not loaded yet: try again on the next interaction
    controller.togglePlay();
    stop();
  }
  events.forEach((t) => addEventListener(t, kick, true));
}

// Only play while the site is on screen: pause when the tab is hidden, resume on return.
let pausedByHide = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pausedByHide = playing;
    if (playing) controller?.pause();
  } else if (pausedByHide) {
    pausedByHide = false;
    controller?.resume();
  }
});

export function useSpotifyPlaying() {
  const [on, setOn] = useState(playing);
  useEffect(() => { listeners.add(setOn); return () => listeners.delete(setOn); }, []);
  return on;
}

// Stand-in spectrum (0..1 per bar, bass first) while Spotify plays: a 120 BPM kick on the low bars,
// slower swells across the middle and flicker up top, phased from the track position so it doesn't
// jump on pause/resume. Not the real audio; see the note at the top.
export function simulatedLevels(out) {
  const t = spotifyPositionMs() / 1000;
  const beat = Math.pow(1 - ((t * 2) % 1), 3); // 2 beats per second, sharp attack, decay
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const kick = beat * Math.max(0, 1 - f * 3);
    const swell = 0.35 + 0.25 * Math.sin(t * 1.3 + i * 0.45) * Math.sin(t * 0.7 + i * 0.17);
    const flick = 0.2 * Math.abs(Math.sin(t * 9.1 + i * 2.3)) * f;
    out[i] = Math.min(1, 0.25 + kick * 0.75 + swell * (1 - f * 0.5) + flick);
  }
  return out;
}
