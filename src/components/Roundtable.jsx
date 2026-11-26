import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TEAM } from '../lib/content';
import { mix, easeInOut, clamp01, lerp } from '../lib/panes';
import { modeFor, cardRadius, MODES } from '../lib/layout';
import { track } from '../lib/track';

// The research pane's log cards. Coming from the map pane they rise from the centre (where the
// globe is, GlobeStage.jsx) and spread along the visible arc of the logs
// disc as a cyclic selection wheel.
const LOGS = 4; // pane index of logs (PANES in panes.js)
const HALF = 5; // visible slots on each side of the selected log
const SLOTS = Array.from({ length: HALF * 2 + 1 }, (_, i) => i - HALF);
const STEP = Math.PI / 13;
const mod = (n, m) => ((n % m) + m) % m;
const seedOf = (k) => mod(k + 2, TEAM.length);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default function Roundtable({ logs, logIndex, onSelectLog }) {
  const N = logs.length;
  const [base, setBase] = useState(logIndex);
  const slotEls = useRef([]);
  const sim = useRef({ orbit: 0, pos: logIndex, last: 0, base: logIndex });
  const countRef = useRef(N);
  countRef.current = N;
  // The base the DOM currently shows. Slot angles use this, not the freshly rounded value, so the
  // cards' text and positions change in the same frame instead of jumping a slot for one frame.
  const shownBase = useRef(base);
  useLayoutEffect(() => { shownBase.current = base; }, [base]);

  useEffect(() => {
    let raf;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const s = sim.current;
      const dt = Math.min(0.05, (now - (s.last || now)) / 1000);
      s.last = now;
      const m = mix();
      s.orbit += 0.1 * dt;
      // Follow the continuous scroll position (App.jsx), via whichever copy of it is nearest on the
      // cyclic wheel so picking a card across the wrap doesn't spin the whole way round.
      const n = countRef.current, want = track.logPos;
      const target = n ? want + n * Math.round((s.pos - want) / n) : want;
      s.pos += (target - s.pos) * (1 - Math.exp(-dt * 14));
      const b = Math.round(s.pos);
      if (b !== s.base) {
        s.base = b;
        setBase(b);
      }

      const W = innerWidth, H = innerHeight;
      const { a, b: bm, k, live } = m;
      const modes = MODES.map((_, i) => modeFor(i, W, H));
      const centre = (mode) => [modes[mode].cx * W, modes[mode].cy * H];
      const memberAngle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / TEAM.length + s.orbit;
      const slotAngle = (j) => (shownBase.current + j - s.pos) * STEP;

      // [x, y, rotation, scale, opacity] for a log card in a given pane mode
      const pos = (i, mode) => {
        const c = centre(mode);
        const r = cardRadius(modes[mode], H);
        if (mode === LOGS) {
          const ang = slotAngle(i);
          // With few logs each copy fades out as it leaves a window one loop wide, so the wrap is a
          // crossfade instead of a card vanishing at one end and popping in at the other.
          const n = countRef.current;
          const loop = n <= HALF * 2 ? clamp01(n / 2 + 0.5 - Math.abs(ang / STEP)) : 1;
          return [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang), 0, 1, loop * clamp01(1 - (Math.abs(ang) - 1.0) / 0.22)];
        }
        const ang = memberAngle(seedOf(i));
        return [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang), 0, 0.85, 0]; // copies leave the seat upright
      };

      const place = (el, i) => {
        if (!el) return;
        // Idle: lay out for the pane we are on. Dragging or animating: blend a → b.
        const A = pos(i, a);
        const B = live ? pos(i, bm) : A;
        let kk = k;
        if (live && ((a === LOGS - 1 && bm === LOGS) || (a === LOGS && bm === LOGS - 1))) {
          const tier = Math.abs(i) >= 3 ? 1 : 0;
          const delay = 0.3 * (a === LOGS - 1 ? tier : 1 - tier);
          kk = easeInOut(clamp01((m.t - delay) / 0.7));
        }
        const x = lerp(A[0], B[0], kk);
        const y = lerp(A[1], B[1], kk);
        const rot = A[2] + wrap(B[2] - A[2]) * kk;
        const sc = lerp(A[3], B[3], kk);
        let op;
        if (!live) op = a === LOGS ? A[4] : 0;
        else if (A[4] < B[4]) op = B[4] * clamp01(kk / 0.3);
        else if (A[4] > B[4]) op = A[4] * clamp01((1 - kk) / 0.3);
        else op = A[4];
        el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${rot}rad) scale(${sc})`;
        el.style.opacity = op;
        // Faded cards are inert: no pointer events, no tab stop, hidden from assistive tech.
        const off = op < 0.3;
        if (el.inert !== off) el.inert = off;
      };

      SLOTS.forEach((j, i) => place(slotEls.current[i], j));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="cards">
      {SLOTS.map((j, i) => {
        // With few logs, render one loop's worth of slots (plus the copy fading in at each end).
        if (!N || Math.abs(j) > Math.ceil(N / 2)) return null;
        const abs = base + j;
        const log = logs[mod(abs, N)];
        return (
          <button
            key={j}
            type="button"
            ref={(el) => (slotEls.current[i] = el)}
            className={`log-card box${j === 0 ? ' is-selected' : ''}`}
            style={{ zIndex: 10 - Math.abs(j) }}
            onClick={() => onSelectLog(abs)}
          >
            <span className="meta"><b>No.{log.n}</b> {log.dotted}</span>
            <span className="title">{log.title}</span>
          </button>
        );
      })}
    </div>
  );
}
