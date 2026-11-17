import { useEffect, useState } from 'react';

const navigation = [
  ['/', 'home'],
  ['/about/', 'about'],
  ['/list/', 'list'],
  ['/gallery/', 'gallery'],
  ['/changelog/', 'changelog'],
];

export default function Layout({ page, children, onNavigate }) {
  const [navHidden, setNavHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let previousY = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      setNavHidden(currentY > 80 && currentY > previousY);
      previousY = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.title = page === 'home' ? 'pouroverleaf' : `${page} · pouroverleaf`;
  }, [page]);

  return (
    <>
      <header className={`site-header${navHidden ? ' nav-hidden' : ''}${menuOpen ? ' menu-open' : ''}`}>
        <div className="inner">
          <a className="site-name" href="/">
            <img src="/img/Logo.png" alt="" />
            <span>pouroverleaf</span>
          </a>
          <button className="menu-toggle" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span>menu</span>
          </button>
          <nav className="site-nav" aria-label="Main navigation">
            {navigation.map(([href, label]) => (
              <a
                key={href}
                href={href}
                aria-current={page === label ? 'page' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  setMenuOpen(false);
                  onNavigate(href);
                }}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="inner">pouroverleaf · School of Informatics, University of Edinburgh · student-run, unofficial</div>
      </footer>
    </>
  );
}
