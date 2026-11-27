import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PANES, goTo, getPaneIndex, initFromHash, paneClass, usePaneIndex } from './lib/panes';
import { autostart } from './lib/spotify';
import { byTag } from './lib/logs';
import { GALLERY, LAYERS } from './lib/content';
import { LOG_WHEEL, NARROW } from './lib/layout';
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
const WHEEL_STEP_PX = 32;
const WHEEL_IDLE_MS = 180;
const SWIPE_STEP_PX = 40;
const PHOTO_REPEAT_PX = 96;

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
  const logs = byTag(tag);
  const N = logs.length;
  const pickTag = (t) => { setTag(t); setLogIndex(0); };
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

  useLayoutEffect(() => {
    document.documentElement.dataset.pane = PANES[index];
    if (index !== LOGS_PANE) {
      setPercolationMask(null);
      return;
    }
    const setMask = () => setPercolationMask({
      cx: innerWidth <= NARROW ? 0.5 : LOG_WHEEL.cx,
      cy: LOG_WHEEL.cy,
      r: LOG_WHEEL.rim,
    });
    setMask();
    addEventListener('resize', setMask);
    return () => removeEventListener('resize', setMask);
  }, [index]);

  useEffect(() => {
    const stepPane = (dir) => goTo(getPaneIndex() + dir);
    const stepLog = (dir) => {
      if (N > 1) setLogIndex((i) => i + dir);
    };
    const stepPhoto = (dir) => {
      if (GALLERY.length) setPhotoIndex((i) => mod(i + dir, GALLERY.length));
    };

    const gestureStep = (pane, target, x, y, horizontal) => {
      if (pane === GALLERY_PANE && (horizontal || target?.closest?.('.stage, .strip, .lightbox'))) return stepPhoto;
      if (pane === LOGS_PANE) {
        const distance = Math.hypot(x - LOG_WHEEL.cx * innerWidth, y - LOG_WHEEL.cy * innerHeight);
        const overWheel = innerWidth > NARROW && Math.abs(distance / innerHeight - LOG_WHEEL.radius) < 0.15;
        if (horizontal || overWheel) return stepLog;
      }
      return stepPane;
    };

    const moveGesture = (gesture, delta, firstStep) => {
      if (!delta || getPaneIndex() !== gesture.pane) return;
      const direction = Math.sign(delta);
      const photos = gesture.step === stepPhoto;
      if (photos && gesture.direction !== direction) {
        gesture.distance = 0;
        gesture.used = false;
      }
      if (gesture.used && !photos) return;
      gesture.direction = direction;
      gesture.distance += delta;
      const threshold = gesture.used ? PHOTO_REPEAT_PX : firstStep;
      const remaining = Math.abs(gesture.distance) - threshold;
      if (remaining < 0) return;
      const steps = photos ? 1 + Math.floor(remaining / PHOTO_REPEAT_PX) : 1;
      gesture.step(Math.sign(gesture.distance) * steps);
      gesture.distance = direction * (remaining % PHOTO_REPEAT_PX);
      gesture.used = true;
    };

    // Keep the gesture with its original control, including momentum after the pane changes.
    let lastWheel = -Infinity, wheelGesture = null;
    const onWheel = (e) => {
      if (e.ctrlKey) return;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX : e.deltaY;
      if (!delta) return;
      if (e.timeStamp - lastWheel > WHEEL_IDLE_MS) {
        const pane = getPaneIndex();
        wheelGesture = scrollerOf(e.target) ? null : {
          pane, step: gestureStep(pane, e.target, e.clientX, e.clientY, horizontal), distance: 0, used: false,
        };
      }
      lastWheel = e.timeStamp;
      if (!wheelGesture) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? innerHeight : 1;
      moveGesture(wheelGesture, delta * unit, WHEEL_STEP_PX);
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
      const pane = getPaneIndex();
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
      if (e.key === 'Escape' && pane === LOGS_PANE) return goTo(MAP_PANE);
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
      if (pane === GALLERY_PANE && (left || right)) { e.preventDefault(); return stepPhoto(right ? 1 : -1); }
      if (!down && !up) return;
      e.preventDefault();
      // On logs, plain up/down browse entries; Shift (⇧↓ ⇧↑ J K), PageUp/PageDown move panes.
      const paneKey = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
      if (pane === LOGS_PANE && !paneKey) return stepLog(down ? 1 : -1);
      goTo(pane + (down ? 1 : -1));
    };

    let touch = null;
    const onTouchStart = (e) => {
      touch = null;
      if (e.touches.length !== 1 || scrollerOf(e.target)) return;
      const { clientX: x, clientY: y } = e.touches[0];
      touch = { x, y, pane: getPaneIndex(), target: e.target, used: false, distance: 0, step: null };
    };
    const onTouchMove = (e) => {
      if (!touch || e.touches.length !== 1) return;
      const dx = touch.x - e.touches[0].clientX, dy = touch.y - e.touches[0].clientY;
      if (!touch.step) {
        touch.horizontal = (touch.pane === LOGS_PANE || touch.pane === GALLERY_PANE) && Math.abs(dx) > Math.abs(dy);
        if (Math.abs(touch.horizontal ? dx : dy) < 8) return;
        touch.step = gestureStep(touch.pane, touch.target, touch.x, touch.y, touch.horizontal);
      }
      e.preventDefault();
      moveGesture(touch, touch.horizontal ? dx : dy, SWIPE_STEP_PX);
      touch.x = e.touches[0].clientX;
      touch.y = e.touches[0].clientY;
    };
    const onTouchEnd = () => { touch = null; };

    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('keydown', onKey);
    addEventListener('touchstart', onTouchStart, { passive: true });
    addEventListener('touchmove', onTouchMove, { passive: false });
    addEventListener('touchend', onTouchEnd);
    addEventListener('touchcancel', onTouchEnd);
    return () => {
      removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKey);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchmove', onTouchMove);
      removeEventListener('touchend', onTouchEnd);
      removeEventListener('touchcancel', onTouchEnd);
    };
  }, [N]);

  const logNumber = N ? mod(logIndex, N) : 0;
  const pane = (i, child, extra = '') => (
    <section key={i} inert={i !== index} className={`pane pane-${PANES[i]} pane-motion ${paneClass(i, index)}${extra}`}>
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
      {pane(LOGS_PANE, <>
        <ResearchPane log={logs[logNumber]} n={logNumber} total={N} tag={tag} onTag={pickTag} />
        <Roundtable logs={logs} logIndex={logIndex} onSelectLog={setLogIndex} />
      </>)}
      {pane(GALLERY_PANE, <GalleryPane active={index === GALLERY_PANE} index={photoIndex} onSelect={setPhotoIndex} />)}
      <IndexBar />
      <ScrollCue />
      {/* Portaled next to the lightbox (also on body) so it stacks above it; #root is its own stacking context. */}
      {cmd !== null && createPortal(<div className="cmdline" aria-live="polite">:{cmd}<i aria-hidden="true" /></div>, document.body)}
    </>
  );
}
