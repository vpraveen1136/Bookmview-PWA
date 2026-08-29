import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { DefaultPlaybackModeSettings } from './DefaultPlaybackModeSettings.jsx';
import { useDb } from '../context/DbContext.jsx';
import { getFolderTotals } from '../lib/categoryFolders.js';
import { usePwaActions } from '../hooks/usePwaActions.js';

export function AppSlideMenu({ open, onClose }) {
  const navigate = useNavigate();
  const { closeDatabase, fileName, library, catalog } = useDb();
  const { summary: pwaActionSummary, exportChanges } = usePwaActions();
  const [exportStatus, setExportStatus] = useState('');

  const onChangeDb = async () => {
    onClose?.();
    await closeDatabase();
    navigate('/');
  };

  const openFolder = (type) => {
    onClose?.();
    navigate(`/folders/${type}`);
  };

  const onExportChanges = async () => {
    setExportStatus('Preparing export...');
    try {
      const result = await exportChanges();
      setExportStatus(result.ok
        ? `Exported ${result.count} changes. Copy ${result.filename} to Google Drive / BookmView.`
        : result.message);
    } catch (error) {
      setExportStatus(error?.message || 'Export failed. Pending changes were kept.');
    }
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
          <h3 className="app-slide-menu-section-title">Sync Changes</h3>
          <p className="app-slide-menu-hint">
            {pwaActionSummary.pending} pending changes
            {pwaActionSummary.exported ? ` · ${pwaActionSummary.exported} exported` : ''}
          </p>
          <button
            type="button"
            className="btn app-slide-menu-btn"
            disabled={!pwaActionSummary.exportable}
            onClick={onExportChanges}
          >
            Export Changes
          </button>
          {exportStatus ? <p className="app-slide-menu-hint">{exportStatus}</p> : null}
        </div>
        <div className="app-slide-menu-section">
          <h3 className="app-slide-menu-section-title">Sources</h3>
          <div className="app-slide-menu-folder-list">
            {(catalog?.sources ?? []).map((source) => {
              const count = (library || []).filter((item) => (
                !item.is_archived && String(item.source_slug || 'x').toLowerCase() === String(source.slug).toLowerCase()
              )).length;
              return (
                <button
                  key={source.slug}
                  type="button"
                  className="app-slide-menu-folder"
                  onClick={() => {
                    onClose?.();
                    if (source.slug === 'x') navigate('/x');
                    else if (source.slug === 'spankbang') navigate('/spankbang');
                    else navigate(`/library?sources=${encodeURIComponent(source.slug)}&refreshSuccess=all`);
                  }}
                >
                  <span>{source.display_name || source.slug}</span>
                  <small>{count}</small>
                </button>
              );
            })}
          </div>
        </div>
        <div className="app-slide-menu-section">
          <h3 className="app-slide-menu-section-title">Folders</h3>
          <div className="app-slide-menu-folder-list">
            {[
              ['cast', 'Cast'],
              ['studio', 'Studio'],
              ['genre', 'Genre'],
            ].map(([id, label]) => {
              const totals = getFolderTotals(library, catalog, id);
              return (
                <button key={id} type="button" className="app-slide-menu-folder" onClick={() => openFolder(id)}>
                  <span>{label}</span>
                  <small>{totals.tags} tags · {totals.assigned}</small>
                </button>
              );
            })}
          </div>
        </div>
        <div className="app-slide-menu-section">
          <h3 className="app-slide-menu-section-title">Mode</h3>
          <DefaultPlaybackModeSettings />
        </div>
      </aside>
    </>
  );
}
