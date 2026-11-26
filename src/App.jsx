import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PANES, goTo, setPosition, subscribe, getTransition, position, mix, initFromHash, usePaneIndex } from './lib/panes';
import { track } from './lib/track';
import { autostart } from './lib/spotify';
import { byTag } from './lib/logs';
import { GALLERY, LAYERS } from './lib/content';
import { modeFor, cardRadius, NARROW } from './lib/layout';
import Percolation, { setPercolationMask } from './components/Percolation';
import Roundtable from './components/Roundtable';
import IndexBar, { ScrollCue } from './components/IndexBar';
import HomePane from './panes/HomePane';
import AboutPane from './panes/AboutPane';
import TeamPane from './panes/TeamPane';
import MapPane from './panes/MapPane';
import GlobeStage from './components/GlobeStage';
import ResearchPane from './panes/ResearchPane';
import GalleryPane from './panes/GalleryPane';

initFromHash();
autostart();
const mod = (n, m) => ((n % m) + m) % m;
const TEAM_PANE = 2;
const MAP_PANE = 3;
const LOGS_PANE = 4;
const GALLERY_PANE = 5;
// The whole site is one continuous track: home 0, about 1, team 2, map 3, logs 4, then one unit per
// photo. Logs browse on their own wheel (spinLogs), off the track. Wheel and touch move along it 1:1; when input stops it eases to the nearest stop.
const PX_PER_UNIT = 400; // wheel pixels per pane / photo
const PX_PER_LOG = 160; // wheel pixels per log on the log wheel, which steps one log at a time
const SNAP_BIAS = 0.2; // past this fraction in the direction you were scrolling, settle on the next stop
const MAP_PULL = 0.6; // the map pane snaps harder: settling anywhere this close to it lands on it
// Elements with class "scroll" (log body, about text) scroll natively when they overflow; wheel and
// touch gestures that start inside one are left to the browser instead of moving panes or items.
const scrollerOf = (target) => {
  const el = target?.closest?.('.scroll');
  if (!el || el.scrollHeight <= el.clientHeight) return null;
  return /auto|scroll/.test(getComputedStyle(el).overflowY) ? el : null; // overflow: hidden doesn't scroll
};

export default function App() {
  const index = usePaneIndex();
  const [tag, setTag] = useState(null);
  const [logIndex, setLogIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [cmd, setCmd] = useState(null); // vim command line: ':' then a pane number or name, Enter to jump
  const cmdRef = useRef(null);
  const setCommand = (v) => { cmdRef.current = v; setCmd(v); };
  const logRef = useRef(0);
  const photoRef = useRef(0);
  const paneEls = useRef([]);
  const logs = byTag(tag);
  const N = logs.length;
  const selectLog = (j) => { logRef.current = j; setLogIndex(j); };
  const selectPhoto = (j) => { photoRef.current = j; setPhotoIndex(j); };
  const pickTag = (t) => { setTag(t); selectLog(0); trackApi.current.resetLogs?.(); };
  // Map layers and the clicked pin: shared by the globe (GlobeStage) and the map pane's key.
  const [layersOn, setLayersOn] = useState(() => new Set(LAYERS.map((l) => l.key)));
  const [pin, setPin] = useState(null);
  const points = useMemo(
    () => LAYERS.filter((l) => layersOn.has(l.key)).flatMap((l) => l.points.map((p) => ({ ...p, color: l.color, layer: l.key }))),
    [layersOn],
  );
  const toggleLayer = (key) => {
    const next = new Set(layersOn);
    if (next.has(key)) next.delete(key); else next.add(key);
    setLayersOn(next);
    if (pin && !next.has(pin.layer)) setPin(null);
  };
  // Filled by the input effect: clicks on a log card or a thumbnail move along the track too.
  const trackApi = useRef({ pickLog: selectLog, pickPhoto: selectPhoto });

  useEffect(() => {
    document.documentElement.dataset.pane = PANES[index];
    // On logs the logo is projected into the percolation where the roundtable disc was.
    const m = modeFor(LOGS_PANE, innerWidth, innerHeight);
    setPercolationMask(index === LOGS_PANE ? { cx: m.cx, cy: m.cy, r: m.rim } : null);
  }, [index]);

  // Slide the HTML panes from the continuous pane position every frame.
  useEffect(() => {
    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pos = position();
      const { a, b } = mix();
      paneEls.current.forEach((el, i) => {
        if (!el) return;
        el.style.transform = `translateY(${(i - pos) * 100}%)`;
        el.style.visibility = i === a || i === b ? 'visible' : 'hidden';
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const Ls = Math.max(N, 1), Gs = Math.max(GALLERY.length, 1);
    const GAL0 = LOGS_PANE, END = GAL0 + Gs; // u = GAL0 + 1 + i is photo i; logs are one stop at LOGS_PANE
    const clampU = (v) => Math.max(0, Math.min(END, v));
    // Where the track is for the current pane and selection (after a goTo, a click, a tag change).
    const uFromState = () => {
      const i = getTransition().index;
      return i <= LOGS_PANE ? i : GAL0 + 1 + mod(photoRef.current, Gs);
    };
    let u = uFromState(), applying = false, lastDir = 0, idleTimer = 0, snapTarget = null, snapRaf = 0, snapLast = 0;
    // The log wheel spins on its own, off the track. lu is the unbounded log position, so it wraps
    // from the last log back to the first forever.
    let lu = 0, luTarget = null, luRaf = 0, luLast = 0;

    // Track position → pane position + fractional photo position.
    const apply = () => {
      let p = u, gp = 0;
      if (u > GAL0 + 1) { p = GALLERY_PANE; gp = u - GAL0 - 1; }
      track.photoPos = gp;
      const pi = Math.round(gp);
      if (mod(photoRef.current, Gs) !== pi) selectPhoto(pi);
      applying = true;
      setPosition(p);
      applying = false;
    };
    const stopLogSnap = () => { luTarget = null; cancelAnimationFrame(luRaf); luRaf = 0; };
    const syncFromState = () => {
      stopLogSnap();
      u = uFromState();
      track.logPos = lu = mod(logRef.current, Ls);
      track.photoPos = mod(photoRef.current, Gs);
    };
    syncFromState();
    const setLu = (v) => {
      track.logPos = lu = v;
      const li = Math.round(v);
      if (logRef.current !== li) selectLog(li);
    };
    const logSnapTick = (now) => {
      if (luTarget === null) return;
      const dt = Math.min(0.05, (now - (luLast || now)) / 1000);
      luLast = now;
      let v = lu + (luTarget - lu) * (1 - Math.exp(-dt * 9));
      if (Math.abs(luTarget - v) < 0.002) { v = luTarget; luTarget = null; }
      setLu(v);
      luRaf = luTarget === null ? 0 : requestAnimationFrame(logSnapTick);
    };
    const logSnapTo = (target) => {
      luTarget = target;
      if (!luRaf) { luLast = 0; luRaf = requestAnimationFrame(logSnapTick); }
    };
    const spinLogs = (units) => { stopLogSnap(); lastDir = Math.sign(units); setLu(lu + units); };
    const settleLogs = () => {
      idleTimer = 0;
      logSnapTo(lastDir > 0 ? Math.ceil(lu - SNAP_BIAS) : lastDir < 0 ? Math.floor(lu + SNAP_BIAS) : Math.round(lu));
    };
    // Is (x, y) on the log wheel? The ring of cards plus half a card either side, wide screens only
    // (narrow screens hide the cards).
    const onLogWheel = (x, y) => {
      const s = getTransition();
      if (s.index !== LOGS_PANE || s.offset || innerWidth <= NARROW) return false;
      const m = modeFor(LOGS_PANE, innerWidth, innerHeight);
      const r = cardRadius(m, innerHeight), dist = Math.hypot(x - m.cx * innerWidth, y - m.cy * innerHeight);
      return dist > r - 0.15 * innerHeight && dist < r + 0.15 * innerHeight;
    };

    const stopSnap = () => { snapTarget = null; cancelAnimationFrame(snapRaf); snapRaf = 0; };
    const snapTick = (now) => {
      if (snapTarget === null) return;
      const dt = Math.min(0.05, (now - (snapLast || now)) / 1000);
      snapLast = now;
      u += (snapTarget - u) * (1 - Math.exp(-dt * (snapTarget === MAP_PANE ? 13 : 9))); // quicker into the map
      if (Math.abs(snapTarget - u) < 0.002) { u = snapTarget; snapTarget = null; }
      apply();
      snapRaf = snapTarget === null ? 0 : requestAnimationFrame(snapTick);
    };
    const snapTo = (target) => {
      snapTarget = clampU(target);
      if (!snapRaf) { snapLast = 0; snapRaf = requestAnimationFrame(snapTick); }
    };
    // Settle on the next stop in the direction of travel once past SNAP_BIAS, else fall back.
    const settle = () => {
      idleTimer = 0;
      if (Math.abs(u - MAP_PANE) < MAP_PULL) return snapTo(MAP_PANE);
      snapTo(lastDir > 0 ? Math.ceil(u - SNAP_BIAS) : lastDir < 0 ? Math.floor(u + SNAP_BIAS) : Math.round(u));
    };
    const move = (units) => {
      if (!units) return;
      if (getTransition().animating) { u = uFromState(); track.photoPos = mod(photoRef.current, Gs); } // a goTo was running: continue from where it was heading
      stopSnap();
      lastDir = Math.sign(units);
      u = clampU(u + units);
      apply();
    };

    // A goTo (index bar, keys, hash) moved the pane: pick the track up from there.
    const unsub = subscribe(() => { if (!applying) { stopSnap(); u = uFromState(); track.photoPos = mod(photoRef.current, Gs); } });

    trackApi.current = {
      // Roundtable cards pass an unbounded index near the wheel's position: spin to it.
      pickLog: (abs) => { lastDir = 0; logSnapTo(abs); },
      pickPhoto: (i) => { stopSnap(); lastDir = 0; snapTo(GAL0 + 1 + mod(i, Gs)); },
      resetLogs: () => { stopLogSnap(); track.logPos = lu = 0; },
    };
    const step = (n) => {
      if (getTransition().animating) u = uFromState();
      lastDir = n;
      snapTo(Math.round(snapTarget ?? u) + n);
    };
    const stepLog = (n) => { lastDir = n; logSnapTo(Math.round(luTarget ?? lu) + n); }, stepPhoto = step;

    // A wheel gesture keeps the mode it started in: spinning the log wheel, or moving along the track.
    let wheelSpins = false, logAcc = 0;
    const onWheel = (e) => {
      if (e.ctrlKey) return; // pinch / ctrl+wheel: globe zoom or browser zoom, not paging
      const s = getTransition();
      if (s.index !== GALLERY_PANE && scrollerOf(e.target)) return; // log text, about text: native scroll
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1; // lines/pages → px
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      if (!idleTimer) { wheelSpins = onLogWheel(e.clientX, e.clientY); logAcc = 0; }
      clearTimeout(idleTimer);
      if (wheelSpins) {
        // Whole steps, each eased by logSnapTo, so small trackpad jitter never shows.
        logAcc += d;
        while (Math.abs(logAcc) >= PX_PER_LOG) { stepLog(Math.sign(logAcc)); logAcc -= Math.sign(logAcc) * PX_PER_LOG; }
        idleTimer = setTimeout(() => { idleTimer = 0; }, 140);
        return;
      }
      move(d / PX_PER_UNIT);
      idleTimer = setTimeout(settle, 140);
    };

    // Keys: arrows / PageUp / PageDown / space, plus vim: j k h l, gg (first pane), G (last pane).
    // Shift+↓/↑ or J/K always change pane, even on logs where plain j/k browse entries.
    let lastG = 0, count = '', countAt = 0;
    // :3 or :gal → pane. Numbers are 1-based like the index bar.
    const runCommand = (text) => {
      const t = text.trim().toLowerCase();
      if (!t) return;
      if (/^\d+$/.test(t)) { const n = Number(t); if (n >= 1 && n <= PANES.length) goTo(n - 1); return; }
      const i = PANES.findIndex((name) => name.startsWith(t));
      if (i >= 0) goTo(i);
    };
    const onKey = (e) => {
      const t = e.target;
      if (t?.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = getTransition();
      if (cmdRef.current !== null) {
        e.preventDefault();
        e.stopImmediatePropagation(); // the command line owns Escape; the lightbox must not also close
        if (e.key === 'Escape') return setCommand(null);
        if (e.key === 'Enter') { runCommand(cmdRef.current); return setCommand(null); }
        if (e.key === 'Backspace') return setCommand(cmdRef.current ? cmdRef.current.slice(0, -1) : null);
        if (e.key.length === 1) setCommand(cmdRef.current + e.key);
        return;
      }
      if (e.key === ':') { e.preventDefault(); return setCommand(''); }
      // Space on a focused button or link presses it, as the browser would.
      if (e.key === ' ' && t?.closest?.('button, a, summary, [tabindex]')) return;
      // count prefix for G: 3G → pane 3
      if (/^\d$/.test(e.key)) {
        const now = performance.now();
        count = now - countAt < 1000 ? count + e.key : e.key;
        countAt = now;
        return;
      }
      const down = ['ArrowDown', 'PageDown', ' ', 'j', 'J'].includes(e.key);
      const up = ['ArrowUp', 'PageUp', 'k', 'K'].includes(e.key);
      const right = e.key === 'ArrowRight' || e.key === 'l', left = e.key === 'ArrowLeft' || e.key === 'h';
      if (e.key === 'Escape' && s.index === LOGS_PANE) return goTo(MAP_PANE);
      if (e.key === 'G') {
        e.preventDefault();
        const n = performance.now() - countAt < 1000 && count ? Number(count) : 0;
        count = '';
        return goTo(n >= 1 && n <= PANES.length ? n - 1 : PANES.length - 1);
      }
      if (e.key === 'g') {
        const now = performance.now();
        if (now - lastG < 500) { lastG = 0; e.preventDefault(); return goTo(0); }
        lastG = now;
        return;
      }
      if (s.index === GALLERY_PANE && (left || right)) { e.preventDefault(); return stepPhoto(right ? 1 : -1); }
      if (!down && !up) return;
      e.preventDefault();
      // On logs, plain up/down browse entries; Shift (⇧↓ ⇧↑ J K), PageUp/PageDown move panes.
      const paneKey = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
      if (s.index === LOGS_PANE && !paneKey) return stepLog(down ? 1 : -1);
      goTo(s.index + (down ? 1 : -1));
    };

    // Touch drags the track like the wheel: vertical everywhere, horizontal too on the gallery.
    // On logs, a drag on the card wheel or any sideways swipe spins the logs (phones hide the cards).
    // A gesture that starts inside a scrolling element belongs to the browser. The globe stops
    // propagation of touches that land on the sphere, so those never reach here.
    let touchX = 0, touchY = 0, touching = false, touchScroll = false, touchWheel = false, touchSpins = false, axis = null;
    const onTouchStart = (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      touching = true;
      axis = null;
      touchScroll = !!scrollerOf(e.target);
      touchWheel = onLogWheel(touchX, touchY);
    };
    const onTouchMove = (e) => {
      if (!touching || touchScroll) return;
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      const dx = touchX - x, dy = touchY - y;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        const s = getTransition();
        const onLogs = s.index === LOGS_PANE && !s.offset;
        axis = Math.abs(dx) > Math.abs(dy) && (s.index === GALLERY_PANE || onLogs) ? 'x' : 'y';
        touchSpins = touchWheel || (onLogs && axis === 'x');
      }
      e.preventDefault();
      touchX = x;
      touchY = y;
      const units = (axis === 'x' ? dx / innerWidth : dy / innerHeight) * 1.6;
      if (touchSpins) spinLogs(units);
      else move(units);
    };
    const onTouchEnd = () => {
      const was = touching && !touchScroll && axis;
      touching = false;
      if (was) (touchSpins ? settleLogs : settle)();
    };

    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('keydown', onKey);
    addEventListener('touchstart', onTouchStart, { passive: true });
    addEventListener('touchmove', onTouchMove, { passive: false });
    addEventListener('touchend', onTouchEnd);
    addEventListener('touchcancel', onTouchEnd);
    return () => {
      unsub();
      stopSnap();
      stopLogSnap();
      clearTimeout(idleTimer);
      removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKey);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchmove', onTouchMove);
      removeEventListener('touchend', onTouchEnd);
      removeEventListener('touchcancel', onTouchEnd);
    };
  }, [N]);

  const current = N ? logs[mod(logIndex, N)] : null;
  const pane = (i, child, extra = '') => (
    <section key={i} ref={(el) => (paneEls.current[i] = el)} className={`pane pane-${PANES[i]}${extra}${i === index ? ' is-active' : ''}`}>
      {child}
    </section>
  );

  return (
    <>
      <Percolation />
      {/* before the panes so they stack above it: the team photo stands in front of the globe */}
      <GlobeStage index={index} points={points} selectedId={pin?.id ?? null} onSelect={setPin} />
      {pane(0, <HomePane active={index === 0} />, ' scroll')} {/* scrolls on landscape phones only (style.css) */}
      {pane(1, <AboutPane />)}
      {pane(TEAM_PANE, <TeamPane active={index === TEAM_PANE} />)}
      {pane(MAP_PANE, <MapPane enabled={layersOn} onToggle={toggleLayer} selected={pin} onClose={() => setPin(null)} />)}
      {pane(LOGS_PANE, <ResearchPane log={current} n={N ? mod(logIndex, N) : 0} total={N} tag={tag} onTag={pickTag} />)}
      {pane(GALLERY_PANE, <GalleryPane active={index === GALLERY_PANE} index={photoIndex} onSelect={(j) => trackApi.current.pickPhoto(j)} />)}
      <Roundtable logs={logs} logIndex={logIndex} onSelectLog={(j) => trackApi.current.pickLog(j)} />
      <IndexBar />
      <ScrollCue />
      {/* Portaled next to the lightbox (also on body) so it stacks above it; #root is its own stacking context. */}
      {cmd !== null && createPortal(<div className="cmdline" aria-live="polite">:{cmd}<i aria-hidden="true" /></div>, document.body)}
    </>
  );
}
