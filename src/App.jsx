import { useEffect, useRef, useState } from 'react';
import { PANES, COMMIT, goTo, setDrag, release, getTransition, position, mix, initFromHash, usePaneIndex } from './lib/panes';
import { byTag } from './lib/logs';
import { MODES } from './lib/layout';
import Percolation, { setPercolationMask } from './components/Percolation';
import Roundtable from './components/Roundtable';
import IndexBar, { ScrollCue } from './components/IndexBar';
import HomePane from './panes/HomePane';
import AboutPane from './panes/AboutPane';
import ResearchPane from './panes/ResearchPane';

initFromHash();
const mod = (n, m) => ((n % m) + m) % m;
// Wheel pixels for a full pane of drag before saturation. ~150px of wheel reaches the commit point.
const DRAG_PX = 260;
const dragFromWheel = (acc) => Math.sign(acc) * 1.15 * (1 - Math.exp(-Math.abs(acc) / DRAG_PX));
const wheelFromDrag = (o) => -DRAG_PX * Math.log(1 - Math.min(0.999, Math.abs(o) / 1.15)) * Math.sign(o);

export default function App() {
  const index = usePaneIndex();
  const [tag, setTag] = useState(null);
  const [logIndex, setLogIndex] = useState(0);
  const logRef = useRef(0);
  const paneEls = useRef([]);
  const logs = byTag(tag);
  const N = logs.length;
  const selectLog = (j) => { logRef.current = j; setLogIndex(j); };
  const pickTag = (t) => { setTag(t); selectLog(0); };

  useEffect(() => {
    document.documentElement.dataset.pane = PANES[index];
    // On research the logo is projected into the percolation where the roundtable disc was.
    const m = MODES[3];
    setPercolationMask(index === 3 ? { cx: m.cx, cy: m.cy, r: m.rim } : null);
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
    let acc = 0, cardAcc = 0, lastEvent = 0, armed = true, releaseTimer = 0, touchY = 0, touching = false;
    const step = (n) => selectLog(logRef.current + n);

    const commitOrRelease = () => {
      releaseTimer = 0;
      // After a commit, ignore the rest of this gesture (trackpad inertia) until a pause.
      if (Math.abs(getTransition().offset) >= COMMIT) armed = false;
      release();
      acc = 0;
    };

    const onWheel = (e) => {
      const body = e.target.closest?.('.log-body');
      if (body && body.scrollHeight > body.clientHeight) return;
      e.preventDefault();
      const s = getTransition();
      const now = performance.now();
      const fresh = now - lastEvent > 200;
      lastEvent = now;
      if (fresh) { armed = true; acc = s.offset ? wheelFromDrag(s.offset) : 0; cardAcc = 0; }
      if (s.animating || !armed) return;
      if (s.index === 3) {
        // research: the wheel only browses logs. Leave with ↑ team, the index bar, Esc or PageUp.
        cardAcc += e.deltaY;
        while (cardAcc > 80) { step(1); cardAcc -= 80; }
        while (cardAcc < -80) { step(-1); cardAcc += 80; }
        return;
      }
      acc += e.deltaY;
      setDrag(dragFromWheel(acc));
      clearTimeout(releaseTimer);
      if (Math.abs(getTransition().offset) >= COMMIT) commitOrRelease();
      else releaseTimer = setTimeout(commitOrRelease, 170);
    };

    const onKey = (e) => {
      if (e.target.matches('input, textarea')) return;
      const s = getTransition();
      const down = ['ArrowDown', 'PageDown', ' '].includes(e.key);
      const up = ['ArrowUp', 'PageUp'].includes(e.key);
      if (e.key === 'Escape' && s.index === 3) return goTo(2);
      if (!down && !up) return;
      e.preventDefault();
      if (s.index === 3) {
        if (e.key === 'PageUp') goTo(2);
        else step(down ? 1 : -1);
      } else goTo(s.index + (down ? 1 : -1));
    };

    const onTouchStart = (e) => { touchY = e.touches[0].clientY; touching = true; };
    const onTouchMove = (e) => {
      if (!touching) return;
      const s = getTransition();
      if (s.index === 3) return;
      e.preventDefault();
      setDrag((touchY - e.touches[0].clientY) / (innerHeight * 0.6));
    };
    const onTouchEnd = (e) => {
      touching = false;
      const s = getTransition();
      if (s.index === 3) {
        const dy = e.changedTouches[0].clientY - touchY;
        if (Math.abs(dy) > 50) step(dy < 0 ? 1 : -1);
        return;
      }
      release();
    };

    addEventListener('wheel', onWheel, { passive: false });
    addEventListener('keydown', onKey);
    addEventListener('touchstart', onTouchStart, { passive: true });
    addEventListener('touchmove', onTouchMove, { passive: false });
    addEventListener('touchend', onTouchEnd);
    return () => {
      removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKey);
      removeEventListener('touchstart', onTouchStart);
      removeEventListener('touchmove', onTouchMove);
      removeEventListener('touchend', onTouchEnd);
    };
  }, [N]);

  const current = N ? logs[mod(logIndex, N)] : null;
  const pane = (i, child) => (
    <section key={i} ref={(el) => (paneEls.current[i] = el)} className={`pane pane-${PANES[i]}${i === index ? ' is-active' : ''}`}>
      {child}
    </section>
  );

  return (
    <>
      <Percolation />
      <div className="frame" aria-hidden="true"><i /><i /><i /><i /></div>
      {pane(0, <HomePane active={index === 0} />)}
      {pane(1, <AboutPane />)}
      {pane(2, null)}
      {pane(3, <ResearchPane log={current} n={N ? mod(logIndex, N) : 0} total={N} tag={tag} onTag={pickTag} />)}
      <Roundtable logs={logs} logIndex={logIndex} onSelectLog={selectLog} />
      <IndexBar />
      <ScrollCue />
    </>
  );
}
