import { Navigate, useNavigate } from 'react-router-dom';

import { useDb } from '../context/DbContext.jsx';
import { CATEGORY_FOLDERS, getFolderTotals } from '../lib/categoryFolders.js';

const ORDER = ['cast', 'studio', 'genre'];

export function FoldersPage() {
  const navigate = useNavigate();
  const { library, catalog, isReady, hydrating } = useDb();

  if (hydrating) {
    return (
      <div className="page youtube-page empty-state yt-empty-state">
        <strong>Restoring folders...</strong>
      </div>
    );
  }

  if (!isReady) return <Navigate to="/" replace />;

  return (
    <div className="page youtube-page">
      <section className="yt-section-head">
        <div>
          <h2>Folders</h2>
          <p>Browse by cast, studio, or genre</p>
        </div>
      </section>
      <div className="yt-folder-grid">
        {ORDER.map((id) => {
          const folder = CATEGORY_FOLDERS[id];
          const totals = getFolderTotals(library, catalog, id);
          return (
            <button
              key={id}
              type="button"
              className="yt-folder-card"
              onClick={() => navigate(`/folders/${id}`)}
            >
              <span className="yt-folder-icon" aria-hidden="true">
                {id === 'cast' ? '👤' : id === 'studio' ? '▣' : '#'}
              </span>
              <span className="yt-folder-title">{folder.title}</span>
              <span className="yt-folder-sub">{totals.tags} tags · {totals.assigned} videos</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
