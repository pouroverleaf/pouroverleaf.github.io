import { Fragment, useEffect, useRef, useState } from 'react';
import AsciiDisc from '../components/AsciiDisc';
import RingBars from '../components/RingBars';
import { HOME } from '../lib/content';
import { getNextSession } from '../lib/session';

function Session({ s }) {
  const b = s.bean || {};
  return (
    <>
      <p className="box-head">next session <span className={`rel${s.live ? ' live' : ''}`}>{s.relative}</span></p>
      {s.title && <p className="session-title">{s.title}</p>}
      <p>
        <time dateTime={s.iso}>{s.label}</time>{s.time ? <>, {s.time}</> : null}, {s.where}.
        {s.theme && <> Theme: {s.theme.toLowerCase()}.</>}
        {s.note && <> {s.note}</>}
      </p>
      {b.farm && (
        <p>
          Bean: {b.farm}{b.process || b.variety ? <> – {[b.process, b.variety].filter(Boolean).join(' ')}</> : null}
          {b.country && <> <span className="bar">|</span> {b.country}</>}.
          {b.notes && <> <span className="notes">{b.notes}.</span></>}
          {(b.roaster || b.roasted) && <> <span className="fine">{[b.roaster, b.roasted && `roasted ${b.roasted}`].filter(Boolean).join(', ')}.</span></>}
        </p>
      )}
    </>
  );
}

export default function HomePane({ active }) {
  const disc = useRef(null);
  const [s, setSession] = useState(getNextSession);
  useEffect(() => {
    const t = setInterval(() => setSession(getNextSession()), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="home">
      <div className="home-text">
        <h1 className="home-line">{HOME.lines.map((l, j) => <Fragment key={j}>{j ? <br /> : null}{l}</Fragment>)}</h1>
        {s && (
          <aside className="session box">
            <Session s={s} />
          </aside>
        )}
      </div>
      <div className="home-art">
        <div className="home-logo">
          <AsciiDisc ref={disc} className="home-disc" fluid />
          <RingBars getDiameter={() => disc.current?.offsetWidth} active={active} />
        </div>
        {s?.image && <img className="home-event-img" key={s.image} src={s.image} alt={s.title || ''} />}
      </div>
    </div>
  );
}
