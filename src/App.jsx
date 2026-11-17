import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import List from './pages/List';
import Gallery from './pages/Gallery';
import Changelog from './pages/Changelog';

const pages = {
  home: Home,
  about: About,
  list: List,
  gallery: Gallery,
  changelog: Changelog,
};

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

function pageFromPath(pathname) {
  const normalizedPath = normalizePath(pathname);
  if (normalizedPath === '/') return 'home';
  const page = normalizedPath.slice(1);
  return page in pages ? page : 'home';
}

function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const page = pageFromPath(path);

  useEffect(() => {
    const handlePopState = () => {
      setPath(normalizePath(window.location.pathname));
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(nextPath) {
    const normalizedPath = normalizePath(nextPath);
    if (normalizedPath === path) return;
    window.history.pushState({}, '', normalizedPath);
    setPath(normalizedPath);
    window.scrollTo(0, 0);
  }

  const Page = pages[page];

  return (
    <Layout page={page} onNavigate={navigate}>
      <div key={path} className="route-transition">
        <Page />
      </div>
    </Layout>
  );
}

export default App;
