import { useEffect, useRef } from 'react';
import Globe from './Globe';
import RingBars from './RingBars';
import { position, easeInOut } from '../lib/panes';
import { NARROW, frameMid } from '../lib/layout';

// The globe lives outside the panes so it can carry over from team to map: behind the group photo
// on team, then moving down and growing as you scroll to map, where the audio bars ring it.
// Below team and past map it slides with those panes.
const TEAM = 2, MAP = 3; // pane indices (PANES in panes.js)
const FIT = 3.9; // camera distance that fills ~77% of the box with the sphere

// Centre and box size (px) of the globe on team and on map.
function layout(W, H) {
  const x = W <= NARROW ? W / 2 : frameMid(W);
  if (W <= NARROW) return { x, team: { y: 0.52 * H, box: Math.min(W, 0.62 * H) }, map: { y: 0.5 * H, box: Math.min(0.95 * W, 0.72 * H) } };
  return { x, team: { y: 0.45 * H, box: 0.8 * H }, map: { y: 0.5 * H, box: 0.76 * H } };
}

export default function GlobeStage({ index, points, selectedId, onSelect }) {
  const stage = useRef(null);
  const bars = useRef(null);
  const sphere = useRef(0); // sphere's on-screen diameter (unscaled), written by Globe each frame

  useEffect(() => {
    let raf, size = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = stage.current;
      if (!el) return;
      const W = innerWidth, H = innerHeight, L = layout(W, H), pos = position();
      // The canvas is laid out at the map size and scaled down for team, so it never re-allocates mid-scroll.
      if (size !== L.map.box) { size = L.map.box; el.style.width = el.style.height = `${size}px`; }
      const k = easeInOut(Math.max(0, Math.min(1, pos - TEAM))); // 0 on team → 1 on map
      const slide = pos < TEAM ? (TEAM - pos) * H : pos > MAP ? -(pos - MAP) * H : 0;
      const y = L.team.y + (L.map.y - L.team.y) * k + slide;
      const s = (L.team.box + (L.map.box - L.team.box) * k) / L.map.box;
      const shown = Math.abs(slide) < H * 1.05;
      el.style.visibility = shown ? 'visible' : 'hidden';
      if (shown) el.style.transform = `translate(${L.x - size / 2}px, ${y - size / 2}px) scale(${s})`;
      if (bars.current) bars.current.style.opacity = k;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="globe-stage" ref={stage}>
      <Globe active={index === TEAM || index === MAP} points={points} color="#710318" fit={FIT} selectedId={selectedId} onSelect={onSelect} sizeRef={sphere} />
      <div className="globe-bars" ref={bars}>
        <RingBars getDiameter={() => sphere.current * 1.04} active={index === MAP || index === TEAM} reach={0.1} />
      </div>
    </div>
  );
}
