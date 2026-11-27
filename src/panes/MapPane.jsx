import { coffeeHeading } from '../lib/coffee-format';
import { LAYERS } from '../lib/content';

function PointCard({ p, onClose }) {
  return (
    <div className="point-card box">
      <button type="button" className="close" onClick={onClose} aria-label="close">×</button>
      <strong>{p.name}</strong>
      <p>
        {p.process ? <>{p.process} {p.variety} <span className="bar">|</span> </> : null}{p.place}.
        {p.notes && <> <span className="notes">{p.notes}.</span></>}
        {p.altitude && <> <span className="fine">{p.altitude}.</span></>}
        {p.note && !p.notes && <> {p.note}</>}
      </p>
      {p.coffees?.length > 0 && <ul>{p.coffees.map(c => <li key={c.id}>{coffeeHeading(c)}{c.region && ` · ${c.region}`}</li>)}</ul>}
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
