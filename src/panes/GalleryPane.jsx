import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GALLERY } from '../lib/content';

// One large photo with a thumbnail bar under it. `index` is unbounded and wraps. Wheel/arrow
// input lives in App.jsx. Click a thumbnail to jump; click the big photo to open it full-size.
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

  // Keep the selected thumbnail centred once the bar is wider than the viewport allows.
  useEffect(() => {
    const strip = stripRef.current, row = rowRef.current, t = thumbs.current[cur];
    if (!strip || !row || !t) return;
    const place = () => {
      if (row.scrollWidth <= strip.clientWidth) {
        row.style.transform = '';
        return;
      }
      const want = strip.clientWidth / 2 - (t.offsetLeft + t.offsetWidth / 2);
      row.style.transform = `translateX(${Math.min(0, Math.max(strip.clientWidth - row.scrollWidth, want))}px)`;
    };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [cur]);

  if (!N) {
    return (
      <div className="gallery">
        <div className="box empty"><p>No photos yet. Drop some into src/content/gallery/.</p></div>
      </div>
    );
  }

  const g = GALLERY[cur];
  const jump = (i) => onSelect(index + (mod(i - cur + N / 2, N) - N / 2));

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
              onClick={() => jump(i)}
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
