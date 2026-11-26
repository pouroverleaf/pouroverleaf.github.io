import { useEffect, useRef } from 'react';
import { getAnalyser } from '../lib/audio';

// Audio bars radiating from a circle (the ASCII logo's ring, the team globe), built from small
// square blocks so they read like characters. `getDiameter()` returns the circle's size in px each
// frame; the canvas is centred on it by CSS.
const BARS = 72; // around the full circle, mirrored left/right
const RED = '#710318';
const REACH = 0.26; // default longest bar, as a fraction of the circle's diameter

export default function RingBars({ getDiameter, active, className = 'ring-bars', reach = REACH }) {
  const canvas = useRef(null);

  useEffect(() => {
    if (!active) return;
    const cv = canvas.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    let raf, data = null, level = new Float32Array(BARS / 2);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const d = getDiameter() || 0;
      if (!d) return;
      const size = Math.round(d * (1 + 2 * reach + 0.1));
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (cv.width !== size * dpr) { cv.width = cv.height = size * dpr; cv.style.width = cv.style.height = `${size}px`; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);

      const an = getAnalyser();
      const half = BARS / 2;
      if (an) {
        if (!data || data.length !== an.frequencyBinCount) data = new Uint8Array(an.frequencyBinCount);
        an.getByteFrequencyData(data);
        // Bars 0..half-1 cover the lower ~45% of the spectrum (where the music is), on a log-ish scale.
        const top = Math.floor(data.length * 0.45);
        for (let i = 0; i < half; i++) {
          const a = Math.floor(Math.pow(i / half, 1.6) * top), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / half, 1.6) * top));
          let v = 0;
          for (let k = a; k < b; k++) v = Math.max(v, data[k]);
          level[i] = Math.max(v / 255, level[i] * 0.88); // quick rise, slow fall
        }
      } else {
        for (let i = 0; i < half; i++) level[i] *= 0.88;
      }

      const c = size / 2, r = d / 2 + d * 0.015;
      const cell = Math.max(2, d / 60); // about one character of the disc
      const step = cell * 1.35;
      g.fillStyle = RED;
      for (let j = 0; j < BARS; j++) {
        // mirrored: bass at the top, highs meeting at the bottom
        const i = j < half ? j : BARS - 1 - j;
        const n = Math.floor((level[i] * level[i] * d * reach) / step);
        if (!n) continue;
        const ang = -Math.PI / 2 + ((j + 0.5) / BARS) * Math.PI * 2;
        g.save();
        g.translate(c, c);
        g.rotate(ang);
        for (let s = 0; s < n; s++) g.fillRect(r + s * step, -cell / 2, cell, cell);
        g.restore();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); g.clearRect(0, 0, cv.width, cv.height); };
  }, [active, reach]); // eslint-disable-line react-hooks/exhaustive-deps -- getDiameter reads refs

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
