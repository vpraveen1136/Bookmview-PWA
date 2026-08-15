import { useNavigate } from 'react-router-dom';

import { DefaultPlaybackModeSettings } from './DefaultPlaybackModeSettings.jsx';
import { useDb } from '../context/DbContext.jsx';

export function AppSlideMenu({ open, onClose }) {
  const navigate = useNavigate();
  const { closeDatabase, fileName } = useDb();

  const onChangeDb = async () => {
    onClose?.();
    await closeDatabase();
    navigate('/');
  };

  return (
    <>
      <div
        className={`app-slide-menu-backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`app-slide-menu ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        aria-label="App menu"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="app-slide-menu-header">
          <h2 className="app-slide-menu-title">Menu</h2>
          <button type="button" className="btn btn-icon" aria-label="Close menu" onClick={onClose}>
            ✕
          </button>
        </div>
        {fileName ? <p className="app-slide-menu-file">{fileName}</p> : null}
        <div className="app-slide-menu-actions">
          <button type="button" className="btn app-slide-menu-btn" onClick={onChangeDb}>
            Change DB
          </button>
        </div>
        <div className="app-slide-menu-section">
          <h3 className="app-slide-menu-section-title">Mode</h3>
          <DefaultPlaybackModeSettings />
        </div>
      </aside>
    </>
  );
}
