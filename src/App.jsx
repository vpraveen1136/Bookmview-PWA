import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { AppHeader } from './components/AppHeader.jsx';
import { MainTabs } from './components/MainTabs.jsx';
import { TabScrollRestoration } from './components/TabScrollRestoration.jsx';
import { PlayabilityProvider } from './context/PlayabilityContext.jsx';
import { useDb } from './context/DbContext.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LibraryPage } from './pages/LibraryPage.jsx';
import { OpenPage } from './pages/OpenPage.jsx';
import { WatchPage } from './pages/WatchPage.jsx';

function ReadyShell({ children }) {
  const location = useLocation();
  const onWatch = location.pathname.startsWith('/watch/');
  const showTabs = !onWatch;

  // iOS status-bar tap-to-scroll-top requires the document/window to be the scroller.
  useEffect(() => {
    const html = document.documentElement;
    if (onWatch) {
      html.classList.remove('app-uses-window-scroll');
    } else {
      html.classList.add('app-uses-window-scroll');
    }
    return () => html.classList.remove('app-uses-window-scroll');
  }, [onWatch]);

  return (
    <div className={`app-shell ${onWatch ? 'app-shell-immersive' : ''} ${showTabs ? 'app-shell-with-tabs' : ''}`}>
      <TabScrollRestoration />
      {!onWatch ? <AppHeader /> : null}
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
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/watch/:tweetId" element={<WatchPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  return <ReadyRoutes />;
}
