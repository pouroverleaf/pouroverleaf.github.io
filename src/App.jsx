import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PANES, COMMIT, goTo, setDrag, release, getTransition, position, mix, initFromHash, usePaneIndex } from './lib/panes';
import { byTag } from './lib/logs';
import { GALLERY } from './lib/content';
import { modeFor } from './lib/layout';
import Percolation, { setPercolationMask } from './components/Percolation';
import Roundtable from './components/Roundtable';
import IndexBar, { ScrollCue } from './components/IndexBar';
import HomePane from './panes/HomePane';
import AboutPane from './panes/AboutPane';
import ResearchPane from './panes/ResearchPane';
import GalleryPane from './panes/GalleryPane';

initFromHash();
const mod = (n, m) => ((n % m) + m) % m;
const LOGS_PANE = 3;
const GALLERY_PANE = 4;
// Wheel pixels for a full pane of drag before saturation. ~150px of wheel reaches the commit point.
const DRAG_PX = 260;
const dragFromWheel = (acc) => Math.sign(acc) * 1.15 * (1 - Math.exp(-Math.abs(acc) / DRAG_PX));
const wheelFromDrag = (o) => -DRAG_PX * Math.log(1 - Math.min(0.999, Math.abs(o) / 1.15)) * Math.sign(o);
// Elements with class "scroll" (log body, about text) scroll natively when they overflow; wheel and
// touch gestures that start inside one are left to the browser instead of moving panes or items.
const scrollerOf = (target) => {
  const el = target?.closest?.('.scroll');
  return el && el.scrollHeight > el.clientHeight ? el : null;
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
  const pickTag = (t) => { setTag(t); selectLog(0); };

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
    let acc = 0, itemAcc = 0, lastEvent = 0, armed = true, releaseTimer = 0, touchX = 0, touchY = 0, touching = false, touchScroll = false;
    const stepLog = (n) => selectLog(logRef.current + n);
    const stepPhoto = (n) => GALLERY.length && selectPhoto(photoRef.current + n);

    const commitOrRelease = () => {
      releaseTimer = 0;
      // After a commit, ignore the rest of this gesture (trackpad inertia) until a pause.
      if (Math.abs(getTransition().offset) >= COMMIT) armed = false;
      release();
      acc = 0;
    };

    // Wheel on logs/gallery browses items, 80px per step, in whichever axis moves most.
    const browse = (e, step) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      itemAcc += d;
      while (itemAcc > 80) { step(1); itemAcc -= 80; }
      while (itemAcc < -80) { step(-1); itemAcc += 80; }
    };

    const onWheel = (e) => {
      if (scrollerOf(e.target)) return;
      e.preventDefault();
      const s = getTransition();
      const now = performance.now();
      const fresh = now - lastEvent > 200;
      lastEvent = now;
      if (fresh) { armed = true; acc = s.offset ? wheelFromDrag(s.offset) : 0; itemAcc = 0; }
      if (s.animating || !armed) return;
      if (s.index === LOGS_PANE) return browse(e, stepLog);
      if (s.index === GALLERY_PANE) return browse(e, stepPhoto);
      acc += e.deltaY;
      setDrag(dragFromWheel(acc));
      clearTimeout(releaseTimer);
      if (Math.abs(getTransition().offset) >= COMMIT) commitOrRelease();
      else releaseTimer = setTimeout(commitOrRelease, 170);
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
      if (e.key === 'Escape' && s.index === LOGS_PANE) return goTo(2);
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

    // Touch. A gesture that starts inside a scrolling element belongs to the browser. The globe
    // stops propagation of touches that land on the sphere, so those never reach here.
    const onTouchStart = (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      touching = true;
      touchScroll = !!scrollerOf(e.target);
    };
    const onTouchMove = (e) => {
      if (!touching || touchScroll) return;
      const s = getTransition();
      if (s.index === LOGS_PANE || s.index === GALLERY_PANE) return;
      e.preventDefault();
      setDrag((touchY - e.touches[0].clientY) / (innerHeight * 0.6));
    };
    const onTouchEnd = (e) => {
      const was = touching && !touchScroll;
      touching = false;
      if (!was) return;
      const s = getTransition();
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (s.index === LOGS_PANE) {
        if (Math.abs(dy) > 50) stepLog(dy < 0 ? 1 : -1);
        return;
      }
      if (s.index === GALLERY_PANE) {
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) stepPhoto(dx < 0 ? 1 : -1);
        else if (dy > 80) goTo(s.index - 1);
        return;
      }
      release();
    };

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

  const current = N ? logs[mod(logIndex, N)] : null;
  const pane = (i, child, extra = '') => (
    <section key={i} ref={(el) => (paneEls.current[i] = el)} className={`pane pane-${PANES[i]}${extra}${i === index ? ' is-active' : ''}`}>
      {child}
    </section>
  );

  return (
    <>
      <Percolation />
      <div className="frame" aria-hidden="true" />
      {pane(0, <HomePane active={index === 0} />, ' scroll')} {/* scrolls on landscape phones only (style.css) */}
      {pane(1, <AboutPane />)}
      {pane(2, null)}
      {pane(LOGS_PANE, <ResearchPane log={current} n={N ? mod(logIndex, N) : 0} total={N} tag={tag} onTag={pickTag} />)}
      {pane(GALLERY_PANE, <GalleryPane active={index === GALLERY_PANE} index={photoIndex} onSelect={selectPhoto} />)}
      <Roundtable logs={logs} logIndex={logIndex} onSelectLog={selectLog} />
      <IndexBar />
      <ScrollCue />
      {/* Portaled next to the lightbox (also on body) so it stacks above it; #root is its own stacking context. */}
      {cmd !== null && createPortal(<div className="cmdline" aria-live="polite">:{cmd}<i aria-hidden="true" /></div>, document.body)}
    </>
  );
}
