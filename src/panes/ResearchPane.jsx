import { useState } from 'react';
import { COFFEES } from '../lib/content';
import { coffeeHeading, coffeeDetails } from '../lib/coffee-format';

export default function ResearchPane({ log, n, total, tag }) {
  const [inventory, setInventory] = useState(false);
  return (
    <div className="research">
      {(inventory || log) ? (
        <>
          <p className="fine wheel-pos">{inventory ? 'Coffee inventory' : `${n + 1} / ${total}`}</p>
          <article className="log box" key={inventory ? 'inventory' : log.id}>
            <header>
              <div className="archive-toolbar">
                <p className="log-no">{inventory ? COFFEES.length + ' coffees' : 'No.' + log.n}</p>
                <button type="button" onClick={() => setInventory(!inventory)}>{inventory ? 'Weekly logs' : 'Coffee inventory'}</button>
              </div>
              <h2>{inventory ? 'Coffee inventory' : log.title}</h2>
              {!inventory && <p className="log-meta">
                <time dateTime={log.date}>{log.dotted}</time>
                {log.tags.map((t) => <span key={t}>{t}</span>)}
                {log.author && <span className="author">by {log.author}</span>}
              </p>}
            </header>
            {inventory ? <div className="log-body scroll">{COFFEES.map((coffee, i) =>
              <section key={coffee.id}>
                <h3 className="coffee-heading">{String(i + 1).padStart(2, '0')} / {coffeeHeading(coffee)}</h3>
                <div dangerouslySetInnerHTML={{ __html: coffeeDetails(coffee, true) }} />
              </section>)}</div> :
              <div className="log-body scroll" dangerouslySetInnerHTML={{ __html: log.html }} />}
          </article>
        </>
      ) : (
        <div className="log box empty">
          <img src="/img/frieren.gif" alt="" />
          <p>{tag ? `No logs tagged “${tag}” yet.` : 'No logs yet.'}<span className="cursor" aria-hidden="true" /></p>
        </div>
      )}
    </div>
  );
}
