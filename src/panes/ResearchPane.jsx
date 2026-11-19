
export default function ResearchPane({ log, n, total, tag, onTag }) {
  return (
    <div className="research">
      {log ? (
        <>
          <p className="fine wheel-pos">{n + 1} / {total}</p>
          <article className="log box" key={log.id}>
            <header>
              <p className="log-no">No.{log.n}</p>
              <h2>{log.title}</h2>
              <p className="log-meta">
                <time dateTime={log.date}>{log.dotted}</time>
                {log.tags.map((t) => <span key={t}>{t}</span>)}
                {log.author && <span className="author">by {log.author}</span>}
              </p>
            </header>
            <div className="log-body scroll" dangerouslySetInnerHTML={{ __html: log.html }} />
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
