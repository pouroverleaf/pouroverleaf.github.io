import { useEffect, useRef } from 'react';
import { PANES, goTo, usePaneIndex } from '../lib/panes';
import { NARROW } from '../lib/layout';

export default function IndexBar() {
  const index = usePaneIndex();
  const bar = useRef(null);
  const brand = useRef(null);

  // Wide: put the left frame line as far past the wordmark as the logo is from the viewport edge.
  // Narrow: the bar is a top row; publish its height so panes can lay out beneath it.
  useEffect(() => {
    const root = document.documentElement;
    const place = () => {
      if (innerWidth <= NARROW) {
        root.style.removeProperty('--gx');
        root.style.setProperty('--nav-h', `${bar.current.offsetHeight}px`);
        return;
      }
      root.style.removeProperty('--nav-h');
      root.style.setProperty('--gx', '11rem');
    };
    const ro = new ResizeObserver(place);
    ro.observe(bar.current);
    addEventListener('resize', place);
    place();
    return () => { ro.disconnect(); removeEventListener('resize', place); root.style.removeProperty('--gx'); root.style.removeProperty('--nav-h'); };
  }, []);

  return (
    <aside ref={bar} className="index">
      <a ref={brand} className="brand" href="#home" onClick={(e) => { e.preventDefault(); goTo(0); }}>
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
