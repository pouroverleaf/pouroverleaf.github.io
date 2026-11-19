import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TEAM } from '../lib/content';
import { mix, easeInOut, clamp01, lerp } from '../lib/panes';
import { modeFor, cardRadius } from '../lib/layout';
import AsciiDisc, { DISC_PX } from './AsciiDisc';

// Committee cards sit around the ASCII disc on the team pane, facing the centre. On the research
// pane the disc slides to the left edge and the cards spread along the visible arc as a cyclic
// selection wheel of research logs.
const HALF = 5; // visible slots on each side of the selected log
const SLOTS = Array.from({ length: HALF * 2 + 1 }, (_, i) => i - HALF);
const STEP = Math.PI / 13;
const mod = (n, m) => ((n % m) + m) % m;
const seedOf = (k) => mod(k + 2, TEAM.length);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default function Roundtable({ logs, logIndex, onSelectLog }) {
  const N = logs.length;
  const [openId, setOpenId] = useState(null);
  const [base, setBase] = useState(logIndex);
  const memberEls = useRef([]);
  const slotEls = useRef([]);
  const discEl = useRef(null);
  const sim = useRef({ orbit: 0, pos: logIndex, last: 0, base: logIndex });
  const targetRef = useRef(logIndex);
  targetRef.current = logIndex;
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
      s.pos += (targetRef.current - s.pos) * (1 - Math.exp(-dt * 8));
      const b = Math.round(s.pos);
      if (b !== s.base) {
        s.base = b;
        setBase(b);
      }

      const W = innerWidth, H = innerHeight;
      const { a, b: bm, k, live } = m;
      const modes = [0, 1, 2, 3, 4].map((i) => modeFor(i, W, H));
      const centre = (mode) => [modes[mode].cx * W, modes[mode].cy * H];
      const memberAngle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / TEAM.length + s.orbit;
      const slotAngle = (j) => (shownBase.current + j - s.pos) * STEP;

      // disc
      const A0 = centre(a), B0 = centre(bm);
      const rimA = modes[a].rim * H, rimB = modes[bm].rim * H;
      const dx = lerp(A0[0], B0[0], k), dy = lerp(A0[1], B0[1], k), dr = lerp(rimA, rimB, k);
      if (discEl.current) {
        const vis = (mode) => (mode === 2 ? 1 : 0);
        discEl.current.style.transform = `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${(2 * dr) / DISC_PX})`;
        discEl.current.style.opacity = lerp(vis(a), vis(bm), k);
      }

      // [x, y, rotation, scale, opacity] for a card in a given pane mode
      const pos = (kind, i, mode) => {
        const c = centre(mode);
        const r = cardRadius(modes[mode], H);
        if (kind === 'm') {
          const ang = memberAngle(i);
          const sc = mode === 2 ? modes[mode].scale ?? 1 : 0.8;
          return [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang), ang + Math.PI / 2, sc, mode === 2 ? 1 : 0];
        }
        if (mode === 3) {
          const ang = slotAngle(i);
          return [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang), 0, 1, clamp01(1 - (Math.abs(ang) - 1.0) / 0.22)];
        }
        const ang = memberAngle(seedOf(i));
        return [c[0] + r * Math.cos(ang), c[1] + r * Math.sin(ang), 0, 0.85, 0]; // copies leave the seat upright
      };

      const place = (el, kind, i) => {
        if (!el) return;
        // Idle: lay out for the pane we are on. Dragging or animating: blend a → b.
        const A = pos(kind, i, a);
        const B = live ? pos(kind, i, bm) : A;
        let kk = k;
        if (live && kind === 'l' && ((a === 2 && bm === 3) || (a === 3 && bm === 2))) {
          const tier = Math.abs(i) >= 3 ? 1 : 0;
          const delay = 0.3 * (a === 2 ? tier : 1 - tier);
          kk = easeInOut(clamp01((m.t - delay) / 0.7));
        }
        const x = lerp(A[0], B[0], kk);
        const y = lerp(A[1], B[1], kk);
        const rot = A[2] + wrap(B[2] - A[2]) * kk;
        const sc = lerp(A[3], B[3], kk);
        let op;
        if (!live) op = kind === 'm' ? (a === 2 ? 1 : 0) : (a === 3 ? A[4] : 0);
        else if (kind === 'm') {
          if (a === 2 && bm === 3) op = 1 - clamp01(kk / 0.35);
          else if (a === 3 && bm === 2) op = clamp01((kk - 0.65) / 0.35);
          else if (bm === 2) op = clamp01((kk - 0.5) / 0.5);
          else if (a === 2) op = 1 - clamp01(kk / 0.5);
          else op = 0;
        } else if (A[4] < B[4]) op = B[4] * clamp01(kk / 0.3);
        else if (A[4] > B[4]) op = A[4] * clamp01((1 - kk) / 0.3);
        else op = A[4];
        el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${rot}rad) scale(${sc})`;
        el.style.opacity = op;
        // Faded cards are inert: no pointer events, no tab stop, hidden from assistive tech.
        const off = op <= 0.5;
        if (el.inert !== off) el.inert = off;
      };

      TEAM.forEach((_, i) => place(memberEls.current[i], 'm', i));
      SLOTS.forEach((j, i) => place(slotEls.current[i], 'l', j));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="cards">
      <AsciiDisc ref={discEl} />
      {TEAM.map((m, i) => (
        <button
          key={m.id}
          type="button"
          ref={(el) => (memberEls.current[i] = el)}
          className={`seat box${openId === m.id ? ' is-open' : ''}`}
          onClick={() => setOpenId(openId === m.id ? null : m.id)}
        >
          <span className="avatar" style={{ background: m.color }}>
            {m.img ? <img src={m.img} alt="" /> : m.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </span>
          <strong>{m.name}</strong>
          <em>{m.title}</em>
          <p>{m.bio}</p>
        </button>
      ))}
      {SLOTS.map((j, i) => {
        // With few logs, show each one once instead of repeating it around the arc.
        if (!N || j < -Math.floor((N - 1) / 2) || j > Math.ceil((N - 1) / 2)) return null;
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
