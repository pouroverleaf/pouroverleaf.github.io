export default function Changelog() {
  return (
    <main className="inner">
      <section>
        <h1>Changelog</h1>
        <div className="changelog">
          <div className="changelog-heading">
            <p className="eyebrow">club notes · 2026</p>
            <p className="lede">A running record of what we brewed, tried, and talked about each week.</p>
          </div>
          <article className="changelog-entry">
            <div className="entry-marker" aria-hidden="true" />
            <div className="entry-content">
              <div className="entry-meta"><span>week 01</span><time dateTime="2026-11-11">11 November 2026</time></div>
              <h2>Dabbling in pourover</h2>
              <img className="entry-image" src="/img/banner.jpg" alt="Members drinking coffee and playing chess at a pouroverleaf session" />
              <div className="entry-grid">
                <section><h3>Theme was</h3><p>Experimenting with different extraction profiles for pour-over.</p></section>
                <section><h3>We tried</h3><p>Different grind sizes, water temperatures, brew ratios, and pouring patterns with the same coffee.</p></section>
                <section><h3>We talked about</h3><p>How extraction changes flavour, how to identify under- and over-extraction, and what makes a brew repeatable.</p></section>
                <section><h3>Equipment used</h3><p>Hario V60 02, Fellow Stagg EKG, Timemore C2, and the Acaia Pearl.</p></section>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
