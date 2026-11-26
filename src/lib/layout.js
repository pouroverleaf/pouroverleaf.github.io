// Screen layout per pane for the logs disc and its cards (index = pane, see PANES in panes.js).
// cx: fraction of viewport width. cy / rim: fractions of viewport height. rim = disc radius.
// gap: distance from the disc edge to the card centres, as a fraction of H.
export const MODES = [
  { cx: 0.5, cy: 1.6, rim: 0.25, gap: 0.13 }, // home: parked below the viewport
  { cx: 0.5, cy: 1.6, rim: 0.25, gap: 0.13 }, // about
  { cx: 0.5, cy: 0.5, rim: 0.25, gap: 0.13 }, // team: centred, disc 0.25H, cards orbit at 0.38H
  { cx: 0.5, cy: 0.5, rim: 0.25, gap: 0.13 }, // map: like team (log cards rise from the globe's centre)
  { cx: 0.06, cy: 0.5, rim: 0.3, gap: 0.1 }, // logs: pushed to the left edge, wheel radius 0.4H
  { cx: 0.06, cy: -0.6, rim: 0.3, gap: 0.1 }, // gallery: parked above the viewport
];

export const NARROW = 1000; // px; below this the index bar is a top row (see style.css)
const SEAT_HALF = 0.085; // half a seat's width, as a fraction of H (seat width is 17vh)

// Layout for pane `i` at viewport W×H. On portrait screens the team ring would run off the sides,
// so the seats shrink (scale) and the ring and disc tighten until the widest seats fit.
// On narrow screens the logs disc (percolation mask) is centred instead of hugging the left edge.
export function modeFor(i, W, H) {
  let m = MODES[i];
  if (i === 4 && W <= NARROW) return { ...m, cx: 0.5 };
  if (i === 3) return modeFor(2, W, H);
  if (i !== 2) return m;
  m = { ...m, cx: frameMid(W) / W };
  const scale = Math.min(1, Math.max(0.5, (W / H) * 1.3));
  const seatHalf = SEAT_HALF * scale;
  const rMax = (0.47 * W / H - seatHalf) / 0.95; // widest seats sit at cos(±18°) ≈ 0.95 of the radius
  const r = Math.min(m.rim + m.gap, rMax);
  if (r >= m.rim + m.gap && scale === 1) return m;
  // (portrait: the ring is sized to the full width, so it stays on the viewport centre)
  m.cx = 0.5;
  const rim = Math.max(0.08, Math.min(m.rim, r - seatHalf - 0.01));
  return { ...m, rim, gap: r - rim, scale };
}

// Centre of the framed area in px: halfway between the left frame line (--gx) and the right one
// (--gr), which differ on wide screens. Called every frame, so getComputedStyle only runs when the
// width or IndexBar's inline --gx changes.
let midCache = { key: '', x: 0 };
export function frameMid(W) {
  const root = document.documentElement;
  const key = `${W}|${root.style.getPropertyValue('--gx')}`;
  if (midCache.key === key) return midCache.x;
  const cs = getComputedStyle(root);
  const rem = parseFloat(cs.fontSize) || 16;
  const px = (v) => { v = v.trim(); return v.endsWith('rem') ? parseFloat(v) * rem : parseFloat(v) || 0; };
  midCache = { key, x: (px(cs.getPropertyValue('--gx')) + W - px(cs.getPropertyValue('--gr'))) / 2 };
  return midCache.x;
}

// Orbit radius for cards around the disc, in px.
export function cardRadius(mode, H) {
  return (mode.rim + mode.gap) * H;
}
