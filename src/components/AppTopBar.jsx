import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppSlideMenu } from './AppSlideMenu.jsx';
import { PrivacyEyeButton } from './PrivacyEyeButton.jsx';
import { useDb } from '../context/DbContext.jsx';

export function AppTopBar() {
  const navigate = useNavigate();
  const { fileName } = useDb();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="yt-topbar">
        <button type="button" className="yt-brand" onClick={() => navigate('/home')} aria-label="BookmView home">
          <span className="yt-brand-mark" aria-hidden="true">▶</span>
          <span>BookmView</span>
        </button>
        <div className="yt-topbar-actions">
          <button type="button" className="yt-icon-btn" aria-label="Search" onClick={() => navigate('/search')}>
            🔍
          </button>
          <PrivacyEyeButton className="yt-icon-btn" compact />
          <button
            type="button"
            className="yt-icon-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
        </div>
        {fileName ? <p className="yt-db-chip">{fileName}</p> : null}
      </header>
      <AppSlideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
