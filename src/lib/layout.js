// Screen layout per pane for the roundtable disc and the cards around it.
// cx: fraction of viewport width. cy / rim: fractions of viewport height. rim = disc radius.
// gap: distance from the disc edge to the card centres, as a fraction of H.
export const MODES = [
  { cx: 0.5, cy: 1.6, rim: 0.25, gap: 0.13 }, // home: parked below the viewport
  { cx: 0.5, cy: 1.6, rim: 0.25, gap: 0.13 }, // about
  { cx: 0.5, cy: 0.5, rim: 0.25, gap: 0.13 }, // team: centred, disc 0.25H, cards orbit at 0.38H
  { cx: 0.06, cy: 0.5, rim: 0.3, gap: 0.1 }, // logs: pushed to the left edge, wheel radius 0.4H
  { cx: 0.06, cy: -0.6, rim: 0.3, gap: 0.1 }, // gallery: parked above the viewport
];

// Orbit radius for cards around the disc, in px.
export function cardRadius(mode, H) {
  return (mode.rim + mode.gap) * H;
}
