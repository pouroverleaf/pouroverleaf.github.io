import { Fragment, useEffect, useMemo, useState } from 'react';
import Globe from '../components/Globe';
import { HOME, LAYERS, SESSION } from '../lib/content';
import { getNextSession } from '../lib/session';

function NextSession() {
  const [s, setS] = useState(getNextSession);
  useEffect(() => {
    const t = setInterval(() => setS(getNextSession()), 60000);
    return () => clearInterval(t);
  }, []);
  const b = SESSION.bean;
  return (
    <aside className="session box">
      <p className="box-head">next session <span className={`rel${s.live ? ' live' : ''}`}>{s.relative}</span></p>
      <p>
        <time dateTime={`${s.iso}T10:00`}>{s.label}</time>, {SESSION.time}, {SESSION.where}.
        {SESSION.theme && <> Theme: {SESSION.theme.toLowerCase()}.</>}
        {!b.farm && <span className="cursor" aria-hidden="true" />}
      </p>
      {b.farm && (
        <p>
          Bean: {b.farm}{b.process || b.variety ? <> – {[b.process, b.variety].filter(Boolean).join(' ')}</> : null}
          {b.country && <> <span className="bar">|</span> {b.country}</>}.
          {b.notes && <> <span className="notes">{b.notes}.</span></>}
          {(b.roaster || b.roasted) && <> <span className="fine">{[b.roaster, b.roasted && `roasted ${b.roasted}`].filter(Boolean).join(', ')}.</span></>}
          <span className="cursor" aria-hidden="true" />
        </p>
      )}
    </aside>
  );
}

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
    </div>
  );
}

// All layers on at the start. Each key toggles its layer. Points carry their layer's colour.
export default function HomePane({ active }) {
  const [enabled, setEnabled] = useState(() => new Set(LAYERS.map((l) => l.key)));
  const [selected, setSelected] = useState(null);
  const points = useMemo(
    () => LAYERS.filter((l) => enabled.has(l.key)).flatMap((l) => l.points.map((p) => ({ ...p, color: l.color, layer: l.key }))),
    [enabled],
  );

  const toggle = (key) => {
    const next = new Set(enabled);
    if (next.has(key)) next.delete(key); else next.add(key);
    setEnabled(next);
    if (selected && !next.has(selected.layer)) setSelected(null);
  };

  return (
    <>
      <div className="globe-wrap">
        <Globe active={active} points={points} color="#710318" selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>
      <h1 className="home-line">{HOME.lines.map((l, i) => <Fragment key={i}>{i ? <br /> : null}{l}</Fragment>)}</h1>
      <aside className="map-key">
        <div className="tabs">
          {LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              className={enabled.has(l.key) ? 'is-active' : ''}
              aria-pressed={enabled.has(l.key)}
              onClick={() => toggle(l.key)}
            >
              <i style={{ background: l.color }} />
              <span>{l.label}</span>
            </button>
          ))}
        </div>
        {selected && <PointCard p={selected} onClose={() => setSelected(null)} />}
      </aside>
      <NextSession />
    </>
  );
}
