import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GALLERY } from '../lib/content';

// The selected photo and its neighbours share the same circular order as the gesture controls.
const N = GALLERY.length;
const middle = Math.floor(N / 2);

function preparePreview(e) {
  const image = e.currentTarget;
  image.dataset.loaded = 'true';
  // Decode while the neighbouring image is mounted so selecting it only changes visibility.
  if (image.hidden) image.decode().catch(() => {});
}

function Photo({ photo, previews, fullSize = false, onClick }) {
  const showOriginal = fullSize && photo.src !== photo.preview;
  const style = {
    '--photo-ratio': photo.thumb.w / photo.thumb.h,
    backgroundImage: `url("${photo.thumb.src}")`,
  };
  return (
    <figure className="photo" onClick={onClick}>
      <div className="photo-picture" style={style}>
        {previews.map((p) => (
          <img key={p.id} src={p.preview} alt={p.alt} hidden={p !== photo} className={showOriginal ? 'underlay' : undefined}
            decoding="async" draggable="false" onLoad={preparePreview} />
        ))}
        {showOriginal && (
          <img key={photo.src} src={photo.src} alt="" decoding="async" draggable="false" onLoad={preparePreview} />
        )}
      </div>
    </figure>
  );
}

export default function GalleryPane({ active, index, onSelect }) {
  const [zoomed, setZoomed] = useState(false);
  const stripRef = useRef(null);
  const rowRef = useRef(null);
  const selectedThumb = useRef(null);
  const previousThumb = useRef(null);

  useEffect(() => {
    if (!active) setZoomed(false);
  }, [active]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => { if (e.key === 'Escape') setZoomed(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [zoomed]);

  useLayoutEffect(() => {
    const previous = previousThumb.current;
    previousThumb.current = active ? selectedThumb.current : null;
    if (!active || !N) return;
    const strip = stripRef.current;
    const row = rowRef.current;
    const thumb = selectedThumb.current;
    const midpoint = (el) => el.offsetLeft + el.offsetWidth / 2;
    const center = () => {
      strip.scrollLeft = midpoint(thumb) - strip.clientWidth / 2;
    };
    if (previous && previous !== thumb) {
      // The circular row is already in its new order. Start it where the old selection was
      // displayed, including any movement still in progress from a previous keypress.
      const css = getComputedStyle(row);
      const carried = css.transform === 'none' ? 0 : new DOMMatrixReadOnly(css.transform).m41;
      const distance = midpoint(thumb) - midpoint(previous);
      const duration = parseFloat(css.getPropertyValue('--strip-time')); // ms
      const timing = { duration, easing: css.getPropertyValue('--spring').trim() };
      row.getAnimations().forEach((animation) => animation.cancel());
      if (duration) {
        row.animate([{ transform: `translateX(${distance + carried}px)` }, { transform: 'translateX(0)' }], timing);
      }
    }
    center();
    // Thumbnail widths follow the viewport height. Keep the selection centred on resize.
    const observer = new ResizeObserver(center);
    observer.observe(strip);
    observer.observe(row);
    return () => observer.disconnect();
  }, [active, index]);

  if (!N) {
    return (
      <div className="gallery">
        <div className="box empty"><p>No photos yet. Drop some into src/content/gallery/.</p></div>
      </div>
    );
  }

  const g = GALLERY[index];
  const previews = active ? GALLERY.filter((_, i) => {
    const distance = Math.abs(i - index);
    return Math.min(distance, N - distance) <= 2;
  }) : [g];

  return (
    <div className="gallery">
      <div className="stage">
        <Photo photo={g} previews={previews} onClick={() => setZoomed(true)} />
      </div>
      <div className="strip" ref={stripRef}>
        <div className="strip-row" ref={rowRef} role="group" aria-label="Gallery photos">
          {GALLERY.map((_, slot) => {
            const i = (index + slot - middle + N) % N;
            const photo = GALLERY[i];
            return (
              <button
                key={photo.id}
                type="button"
                ref={i === index ? selectedThumb : null}
                className={`thumb${i === index ? ' is-selected' : ''}`}
                aria-label={`Photo ${i + 1}, ${photo.alt}`}
                aria-current={i === index || undefined}
                onClick={() => onSelect(i)}
              >
                <img src={photo.thumb.src} width={photo.thumb.w} height={photo.thumb.h} alt="" loading="lazy" decoding="async" draggable="false" />
              </button>
            );
          })}
        </div>
      </div>
      <p className="fine strip-pos">{index + 1} / {N}</p>
      {zoomed && createPortal(
        <div className="lightbox" onClick={() => setZoomed(false)} role="dialog" aria-label="photo">
          <Photo photo={g} previews={[g]} fullSize />
          <p className="fine">{index + 1} / {N}</p>
        </div>,
        document.body,
      )}
    </div>
  );
}
