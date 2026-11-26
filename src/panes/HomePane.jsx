import { Fragment, useEffect, useRef, useState } from 'react';
import AsciiDisc from '../components/AsciiDisc';
import RingBars from '../components/RingBars';
import { HOME } from '../lib/content';
import { getUpcoming } from '../lib/session';

const SHOWN = 2; // sessions the box cycles through: the closest one, then the one after
const CYCLE_MS = 8000; // time on each before the bar runs out (paused while hovered)

function Session({ s, first }) {
  const b = s.bean || {};
  return (
    <>
      <p className="box-head">{first ? 'next session' : 'after that'} <span className={`rel${s.live ? ' live' : ''}`}>{s.relative}</span></p>
      {s.title && <p className="session-title">{s.title}</p>}
      <p>
        <time dateTime={s.iso}>{s.label}</time>{s.time ? <>, {s.time}</> : null}, {s.where}.
        {s.theme && <> Theme: {s.theme.toLowerCase()}.</>}
        {s.note && <> {s.note}</>}
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
    </>
  );
}

// Headline and the next-session box on the left; the ASCII logo on the right, with the shown
// session's image (events.md) under it when it has one. The box shows the closest session, a bar
// under it fills, then it shows the one after, then cycles back.
export default function HomePane({ active }) {
  const disc = useRef(null);
  const [list, setList] = useState(() => getUpcoming(SHOWN));
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setList(getUpcoming(SHOWN)), 60000);
    return () => clearInterval(t);
  }, []);
  const k = list.length ? i % list.length : 0;
  const s = list[k];

  return (
    <div className="home">
      <div className="home-text">
        <h1 className="home-line">{HOME.lines.map((l, j) => <Fragment key={j}>{j ? <br /> : null}{l}</Fragment>)}</h1>
        {s && (
          <div className="session-wrap">
            <aside className="session box" key={s.iso + k}>
              <Session s={s} first={k === 0} />
            </aside>
            {list.length > 1 && (
              <div className="session-timer" aria-hidden="true">
                <i key={k} style={{ animationDuration: `${CYCLE_MS}ms` }} onAnimationEnd={() => setI((n) => (n + 1) % list.length)} />
              </div>
            )}
          </div>
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
