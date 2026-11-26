import { forwardRef, useEffect, useRef } from 'react';

// The roundtable, drawn in characters: an outer ring, a dotted inner ring, and the club logo
// sampled from /img/Logo.png. Rendered once at a fixed font size; the parent scales and positions the <pre>.
export const DISC_COLS = 60;
export const DISC_FONT = 12; // px; JetBrains Mono advance is 0.6em, so the base diameter is COLS * 0.6 * FONT
export const DISC_PX = DISC_COLS * 0.6 * DISC_FONT;
const ROWS = Math.round(DISC_COLS * 0.6);
const N = 96;

// `className` replaces the default "disc"; `fluid` leaves the font size to CSS (diameter = 36 × font size).
const AsciiDisc = forwardRef(function AsciiDisc({ className = 'disc', fluid = false }, ref) {
  const inner = useRef(null);

  useEffect(() => {
    const pre = inner.current;
    let alpha = null;
    const img = new Image();
    img.src = '/img/Logo.png';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, N, N);
      const d = ctx.getImageData(0, 0, N, N).data;
      alpha = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) alpha[i] = d[i * 4 + 3] / 255;
      render();
    };

    const render = () => {
      let html = '';
      for (let r = 0; r < ROWS; r++) {
        let cls = '', run = '';
        const flush = () => { html += cls ? `<span class="${cls}">${run}</span>` : run; run = ''; };
        for (let c = 0; c < DISC_COLS; c++) {
          const x = ((c + 0.5) / DISC_COLS) * 2 - 1;
          const y = ((r + 0.5) / ROWS) * 2 - 1;
          const d = Math.hypot(x, y);
          let ch = ' ', k = '';
          if (d <= 1) {
            if (d > 0.92) { ch = '@'; k = 'r'; }
            else if (d > 0.85) { ch = (c + r) % 2 ? ':' : ' '; k = 'r'; }
            else {
              const u = x / 0.76, v = y / 0.76;
              let a = 0;
              if (alpha && Math.abs(u) < 1 && Math.abs(v) < 1) {
                a = alpha[Math.min(N - 1, (((v + 1) / 2) * N) | 0) * N + Math.min(N - 1, (((u + 1) / 2) * N) | 0)];
              }
              if (a > 0.6) { ch = '%'; k = 'l'; }
              else if (a > 0.25) { ch = '+'; k = 'l'; }
              else if (r % 2 === 0 && c % 2 === 0) { ch = '·'; k = 'd'; }
            }
          }
          if (k !== cls) { flush(); cls = k; }
          run += ch;
        }
        flush();
        html += '\n';
      }
      pre.innerHTML = html;
    };
    render();
  }, []);

  return (
    <div ref={ref} className={className} aria-hidden="true">
      <pre ref={inner} style={fluid ? undefined : { fontSize: DISC_FONT, lineHeight: `${DISC_FONT}px` }} />
    </div>
  );
});

export default AsciiDisc;
