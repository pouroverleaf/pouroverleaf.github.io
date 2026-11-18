import { useEffect, useRef } from 'react';

// Site percolation on a square lattice. Cells are resampled slowly; larger clusters draw darker,
// the largest in red. Normally the occupancy sits near p_c ≈ 0.593 so clusters form and break.
// With a mask set (research pane) the logo is projected into the lattice: cells inside the logo
// fill with p = 0.710, everything else with p = 0.318, so the logo emerges as the percolating cluster.
const CELL = 12;
const P_IN = 0.71;
const P_OUT = 0.318;
const BINS_FREE = [[4, 'rgba(105,56,29,0.02)'], [30, 'rgba(105,56,29,0.032)'], [300, 'rgba(105,56,29,0.045)'], [Infinity, 'rgba(113,3,24,0.06)']];
const BINS_MASK = [[4, 'rgba(105,56,29,0.03)'], [30, 'rgba(105,56,29,0.05)'], [300, 'rgba(105,56,29,0.09)'], [Infinity, 'rgba(113,3,24,0.16)']];
const N = 128;

let mask = null; // { cx, cy, r } as fractions of viewport (r of height)
export function setPercolationMask(m) {
  mask = m;
}

export default function Percolation() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, cols, rows, grid, parent, size, raf, frame = 0, burst = 0, lastMask = null, alpha = null;

    const img = new Image();
    img.src = '/img/Logo.png';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data;
      alpha = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) alpha[i] = d[i * 4 + 3] / 255;
    };

    const resize = () => {
      W = canvas.width = innerWidth;
      H = canvas.height = innerHeight;
      cols = Math.ceil(W / CELL);
      rows = Math.ceil(H / CELL);
      grid = new Uint8Array(cols * rows);
      parent = new Int32Array(cols * rows);
      size = new Int32Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < 0.59 ? 1 : 0;
      burst = 90;
    };

    const find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };

    const targetP = (i, now) => {
      if (!mask) return 0.593 + 0.03 * Math.sin(now / 11000);
      if (!alpha) return P_OUT;
      const r = mask.r * H * 0.95;
      const u = (((i % cols) + 0.5) * CELL - mask.cx * W) / r;
      const v = (((i / cols) | 0) + 0.5) * CELL - mask.cy * H;
      const vv = v / r;
      if (Math.abs(u) >= 1 || Math.abs(vv) >= 1) return P_OUT;
      // Max over a 3×3 neighbourhood thickens the logo's thin rings to a few cells.
      const cx = ((u + 1) / 2) * N, cy = ((vv + 1) / 2) * N;
      let a = 0;
      for (let dy = -2; dy <= 2; dy += 2) {
        for (let dx = -2; dx <= 2; dx += 2) {
          const i = Math.min(N - 1, Math.max(0, (cy + dy) | 0)) * N + Math.min(N - 1, Math.max(0, (cx + dx) | 0));
          if (alpha[i] > a) a = alpha[i];
        }
      }
      return a > 0.4 ? P_IN : P_OUT;
    };

    const draw = () => {
      for (let i = 0; i < parent.length; i++) {
        parent[i] = i;
        size[i] = 0;
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (!grid[i]) continue;
          if (x + 1 < cols && grid[i + 1]) {
            const a = find(i), b = find(i + 1);
            if (a !== b) parent[a] = b;
          }
          if (y + 1 < rows && grid[i + cols]) {
            const a = find(i), b = find(i + cols);
            if (a !== b) parent[a] = b;
          }
        }
      }
      for (let i = 0; i < grid.length; i++) if (grid[i]) size[find(i)]++;
      const BINS = mask ? BINS_MASK : BINS_FREE;
      const bins = BINS.map(() => []);
      for (let i = 0; i < grid.length; i++) {
        if (!grid[i]) continue;
        const s = size[find(i)];
        bins[BINS.findIndex(([max]) => s <= max)].push(i);
      }
      ctx.clearRect(0, 0, W, H);
      bins.forEach((cells, b) => {
        ctx.fillStyle = BINS[b][1];
        for (const i of cells) ctx.fillRect((i % cols) * CELL + 2, ((i / cols) | 0) * CELL + 2, CELL - 4, CELL - 4);
      });
    };

    const tick = (now) => {
      frame++;
      if (mask !== lastMask) {
        lastMask = mask;
        burst = 90;
      }
      const rate = burst > 0 ? 0.05 : 0.0012;
      if (burst > 0) burst--;
      const flips = Math.max(1, (grid.length * rate) | 0);
      for (let n = 0; n < flips; n++) {
        const i = (Math.random() * grid.length) | 0;
        grid[i] = Math.random() < targetP(i, now) ? 1 : 0;
      }
      if (frame % 4 === 0) draw();
      raf = requestAnimationFrame(tick);
    };

    resize();
    draw();
    if (!still) raf = requestAnimationFrame(tick);
    addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="percolation" aria-hidden="true" />;
}
