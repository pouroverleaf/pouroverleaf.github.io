import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GALLERY } from '../lib/content';
import { track } from '../lib/track';

// One large photo with a thumbnail bar under it. Wheel/arrow input and the scroll position live in
// App.jsx. Click a thumbnail to jump; click the big photo to open it full-size.
const N = GALLERY.length;
const mod = (n, m) => ((n % m) + m) % m;

export default function GalleryPane({ active, index, onSelect }) {
  const [zoomed, setZoomed] = useState(false);
  const stripRef = useRef(null);
  const rowRef = useRef(null);
  const thumbs = useRef([]);
  const cur = mod(index, N);

  useEffect(() => {
    if (!active) setZoomed(false);
  }, [active]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => { if (e.key === 'Escape') setZoomed(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [zoomed]);

  // Keep the scroll position centred in the thumbnail bar once it is wider than the viewport. The
  // position is fractional while scrolling, so the bar glides between thumbnails every frame.
  useEffect(() => {
    if (!active) return;
    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const strip = stripRef.current, row = rowRef.current;
      if (!strip || !row) return;
      if (row.scrollWidth <= strip.clientWidth) { row.style.transform = ''; return; }
      const p = Math.max(0, Math.min(N - 1, track.photoPos));
      const i = Math.floor(p), f = p - i;
      const mid = (el) => (el ? el.offsetLeft + el.offsetWidth / 2 : 0);
      const a = thumbs.current[i], b = thumbs.current[Math.min(N - 1, i + 1)];
      const c = mid(a) + (mid(b) - mid(a)) * f;
      const want = strip.clientWidth / 2 - c;
      row.style.transform = `translateX(${Math.min(0, Math.max(strip.clientWidth - row.scrollWidth, want))}px)`;
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

  const g = GALLERY[cur];

  return (
    <div className="gallery">
      <div className="stage">
        <figure className="photo" key={g.id} onClick={() => setZoomed(true)}>
          <img src={g.src} alt={g.alt} draggable="false" />
        </figure>
      </div>
      <div className="strip" ref={stripRef}>
        <div className="strip-row" ref={rowRef} role="list">
          {GALLERY.map((p, i) => (
            <button
              key={p.id}
              type="button"
              ref={(el) => (thumbs.current[i] = el)}
              className={`thumb${i === cur ? ' is-selected' : ''}`}
              role="listitem"
              aria-current={i === cur || undefined}
              onClick={() => onSelect(i)}
            >
              <img src={p.src} alt="" loading="lazy" draggable="false" />
            </button>
          ))}
        </div>
      </div>
      <p className="fine strip-pos">{cur + 1} / {N}</p>
      {zoomed && createPortal(
        <div className="lightbox" onClick={() => setZoomed(false)} role="dialog" aria-label="photo">
          <figure className="photo">
            <img src={g.src} alt={g.alt} draggable="false" />
          </figure>
          <p className="fine">{cur + 1} / {N}</p>
        </div>,
        document.body,
      )}
    </div>
  );
}
