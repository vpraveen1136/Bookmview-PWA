import { useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useDb } from '../context/DbContext.jsx';

export function OpenPage() {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { loadFromFile, loading, loadError, isReady, hydrating } = useDb();

  if (hydrating) {
    return (
      <div className="page">
        <div className="open-card">
          <h2>Restoring library</h2>
          <p className="privacy-note">Loading your saved database from this device…</p>
        </div>
      </div>
    );
  }

  if (isReady) {
    return <Navigate to="/x" replace />;
  }

  const onPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await loadFromFile(file);
      navigate('/x');
    } catch {
      // loadError set in context
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="page">
      <div className="open-card">
        <h2>Open library database</h2>
        <p>
          Choose your BookmView <code>.db</code> file from Files. The database is read in your browser only;
          nothing is uploaded to GitHub or any server.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".db,.sqlite,.sqlite3,application/octet-stream"
          hidden
          onChange={onPick}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? 'Loading…' : 'Choose database file'}
        </button>
        {loadError ? (
          <p className="playback-error" style={{ marginTop: '1rem' }} role="alert">
            {loadError}
          </p>
        ) : null}
        <p className="privacy-note">
          Your database is saved on this device only (private storage). You choose the file once; reloads and
          reopening the app reuse it until you tap <strong>Change DB</strong>.
        </p>
        <p className="privacy-note">
          To update the library, copy a newer <code>bookmview.db</code> from desktop and choose it again.
        </p>
      </div>
    </div>
  );
}
