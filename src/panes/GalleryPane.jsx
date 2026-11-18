import { useEffect, useRef } from 'react';
import { GALLERY } from '../lib/content';

// Cover-flow carousel. `index` is the selected photo (unbounded; wraps). Wheel/arrow input lives in App.jsx.
const SIDE = 3; // photos shown on each side of the centre
const N = GALLERY.length;
const mod = (n, m) => ((n % m) + m) % m;
const wrap = (d) => mod(d + N / 2, N) - N / 2; // shortest signed distance around the loop

export default function GalleryPane({ active, index, onSelect }) {
  const els = useRef([]);
  const sim = useRef({ pos: index, last: 0 });
  const target = useRef(index);
  target.current = index;

  useEffect(() => {
    if (!N) return;
    let raf;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const s = sim.current;
      const dt = Math.min(0.05, (now - (s.last || now)) / 1000);
      s.last = now;
      s.pos += (target.current - s.pos) * (1 - Math.exp(-dt * 9));
      const H = innerHeight;
      const gap0 = 0.4 * H; // centre → first neighbour
      const gap = 0.11 * H; // between neighbours
      els.current.forEach((el, i) => {
        if (!el) return;
        const d = wrap(i - s.pos);
        const a = Math.abs(d), sg = Math.sign(d) || 1;
        if (a > SIDE + 0.5) {
          el.style.visibility = 'hidden';
          return;
        }
        el.style.visibility = 'visible';
        const t = Math.min(1, a); // 0 at centre, 1 once it is a side item
        const x = sg * (t * gap0 + Math.max(0, a - 1) * gap);
        const rot = -sg * t * 58;
        const z = -t * 0.22 * H - Math.max(0, a - 1) * 0.02 * H;
        el.style.transform = `translate(-50%, -50%) translate3d(${x}px, 0, ${z}px) rotateY(${rot}deg)`;
        el.style.zIndex = String(100 - Math.round(a * 10));
        el.style.opacity = a > SIDE ? String(1 - (a - SIDE) * 2) : '1';
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!N) {
    return (
      <div className="gallery">
        <div className="box empty"><p>No photos yet. Drop some into src/content/gallery/.</p></div>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="flow" role="list">
        {GALLERY.map((g, i) => (
          <figure
            key={g.id}
            ref={(el) => (els.current[i] = el)}
            className={`photo${mod(index, N) === i ? ' is-centre' : ''}`}
            role="listitem"
            onClick={() => onSelect(index + wrap(i - index))}
          >
            <img src={g.src} alt={g.alt} loading={Math.abs(wrap(i - index)) <= 1 ? 'eager' : 'lazy'} draggable="false" />
          </figure>
        ))}
      </div>
      <p className="fine flow-pos">{mod(index, N) + 1} / {N} · scroll or ← → to browse</p>
    </div>
  );
}
