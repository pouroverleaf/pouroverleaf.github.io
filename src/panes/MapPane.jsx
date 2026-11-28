import { LAYERS } from '../lib/content';

function PointCard({ p, onClose }) {
  const url = p.source || p.reference || `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  return (
    <div className="point-card box">
      <button type="button" className="close" onClick={onClose} aria-label="close">×</button>
      <strong><a href={url} target="_blank" rel="noreferrer">{p.name}</a></strong>
      {p.place && <p>{p.place}</p>}
      {p.map_note && <p>{p.map_note}</p>}
    </div>
  );
}

// The map pane: the globe itself is GlobeStage (shared with team, outside the panes); this adds the
// layer key and the card for a clicked pin.
export default function MapPane({ enabled, onToggle, selected, onClose }) {
  return (
    <>
      <aside className="map-key">
        <div className="tabs">
          {LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              className={enabled.has(l.key) ? 'is-active' : ''}
              aria-pressed={enabled.has(l.key)}
              onClick={() => onToggle(l.key)}
            >
              <i style={{ background: l.color }} />
              <span>{l.label}</span>
            </button>
          ))}
        </div>
        {selected && <PointCard p={selected} onClose={onClose} />}
      </aside>
    </>
  );
}
