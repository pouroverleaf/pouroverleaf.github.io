import { PANES, goTo, usePaneIndex } from '../lib/panes';

export default function IndexBar() {
  const index = usePaneIndex();
  return (
    <aside className="index">
      <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); goTo(0); }}>
        <img src="/img/Logo.png" alt="" width="28" height="28" />
        <span>pouroverleaf</span>
      </a>
      <ol className="index-list">
        {PANES.map((name, i) => (
          <li key={name} className={i === index ? 'is-active' : ''}>
            <button type="button" onClick={() => goTo(i)}>
              <span className="num">0{i + 1}</span>
              <span className="label">{name}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ↑ / ↓ pane buttons. ↑ top right, ↓ bottom right (bottom centre on home). Hidden at the ends.
export function ScrollCue() {
  const index = usePaneIndex();
  return (
    <>
      {index > 0 && (
        <button type="button" className="cue cue-up" onClick={() => goTo(index - 1)}>
          <span className="arr up" aria-hidden="true">↑</span> {PANES[index - 1]}
        </button>
      )}
      {index < PANES.length - 1 && (
        <button type="button" className="cue cue-down" onClick={() => goTo(index + 1)}>
          {PANES[index + 1]} <span className="arr" aria-hidden="true">↓</span>
        </button>
      )}
    </>
  );
}
