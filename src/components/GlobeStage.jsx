import { useLayoutEffect, useRef } from 'react';
import Globe from './Globe';
import RingBars from './RingBars';
import { NARROW } from '../lib/layout';
import { paneClass } from '../lib/panes';

const TEAM = 2, MAP = 3;
const FIT = 3.9; // camera distance that fills ~77% of the box with the sphere

export default function GlobeStage({ index, points, selectedId, onSelect }) {
  const stage = useRef(null);
  const sphere = useRef(0); // on-screen diameter, written by Globe each frame
  const visible = index === TEAM || index === MAP;
  const layoutPane = index <= TEAM ? TEAM : MAP;

  // Keep the WebGL drawing buffer at the map size while the compositor scales the globe on Team.
  useLayoutEffect(() => {
    const size = () => {
      const narrow = innerWidth <= NARROW;
      const team = narrow ? Math.min(innerWidth, innerHeight * 0.62) : innerHeight * 0.8;
      const map = narrow ? Math.min(innerWidth * 0.80, innerHeight * 0.72) : innerHeight * 0.76;
      stage.current.style.width = `${map}px`;
      stage.current.style.setProperty('--team-scale', team / map);
    };
    size();
    addEventListener('resize', size);
    return () => removeEventListener('resize', size);
  }, []);

  return (
    <div ref={stage} inert={!visible} data-layout={layoutPane === TEAM ? 'team' : 'map'} className={`globe-stage pane-motion ${paneClass(layoutPane, index)}`}>
      <Globe active={visible} points={points} color="#710318" fit={FIT} selectedId={selectedId} onSelect={onSelect} sizeRef={sphere} />
      <div className="globe-bars">
        <RingBars getDiameter={() => sphere.current * 1.04} active={visible} reach={0.1} idleBlocks={1} />
      </div>
    </div>
  );
}
