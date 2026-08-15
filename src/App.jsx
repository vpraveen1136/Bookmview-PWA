import { useLayoutEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { MainTabs } from './components/MainTabs.jsx';
import { TabScrollRestoration } from './components/TabScrollRestoration.jsx';
import { PlayabilityProvider } from './context/PlayabilityContext.jsx';
import { useDb } from './context/DbContext.jsx';
import { OpenPage } from './pages/OpenPage.jsx';
import { SpankbangSourcePage } from './pages/SpankbangSourcePage.jsx';
import { WatchPage } from './pages/WatchPage.jsx';
import { XSourcePage } from './pages/XSourcePage.jsx';
import { SpankbangEmbedPocPage } from './pages/dev/SpankbangEmbedPocPage.jsx';

const SPANKBANG_EMBED_POC_PATH = '/dev/spankbang-embed-poc';

function ReadyShell({ children }) {
  const location = useLocation();
  const onWatch = location.pathname.startsWith('/watch/');
  const onSpankbangEmbedPoc = location.pathname === SPANKBANG_EMBED_POC_PATH;
  const immersive = onWatch || onSpankbangEmbedPoc;
  const showTabs = !immersive;

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (immersive) {
      html.classList.remove('app-uses-window-scroll');
    } else {
      html.classList.add('app-uses-window-scroll');
    }
    return () => html.classList.remove('app-uses-window-scroll');
  }, [immersive]);

  return (
    <div className={`app-shell ${immersive ? 'app-shell-immersive' : ''} ${showTabs ? 'app-shell-with-tabs' : ''}`}>
      <TabScrollRestoration />
      <div className="app-shell-body">{children}</div>
      {showTabs ? <MainTabs /> : null}
    </div>
  );
}

function ReadyRoutes() {
  return (
    <PlayabilityProvider>
      <ReadyShell>
        <Routes>
          <Route path="/x" element={<XSourcePage />} />
          <Route path="/spankbang" element={<SpankbangSourcePage />} />
          <Route path="/dashboard" element={<Navigate to="/x" replace />} />
          <Route path="/library" element={<Navigate to="/spankbang" replace />} />
          <Route path="/watch/:tweetId" element={<WatchPage />} />
          <Route path={SPANKBANG_EMBED_POC_PATH} element={<SpankbangEmbedPocPage />} />
          <Route path="*" element={<Navigate to="/x" replace />} />
        </Routes>
      </ReadyShell>
    </PlayabilityProvider>
  );
}

export function App() {
  const { isReady, hydrating } = useDb();

  if (hydrating) {
    return (
      <div className="app-shell">
        <div className="page empty-state">Restoring your library…</div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<OpenPage />} />
          <Route path="/dev/spankbang-embed-poc" element={<SpankbangEmbedPocPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  return <ReadyRoutes />;
}
