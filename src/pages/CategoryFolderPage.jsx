import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { SourceAppChrome } from '../components/SourceAppChrome.jsx';
import { useDb } from '../context/DbContext.jsx';

const FOLDERS = {
  cast: {
    title: 'Cast',
    param: 'movieCast',
    valuesFor: (bookmark) => bookmark.casts ?? [],
  },
  studio: {
    title: 'Studio',
    param: 'movieStudio',
    valuesFor: (bookmark) => (bookmark.studio ? [bookmark.studio] : []),
  },
  genre: {
    title: 'Genre',
    param: 'movieGenre',
    valuesFor: (bookmark) => bookmark.genres ?? [],
  },
};

function countFolderValues(library, folder) {
  const counts = new Map();
  for (const bookmark of library || []) {
    if (bookmark.is_archived) continue;
    for (const rawValue of folder.valuesFor(bookmark)) {
      const value = String(rawValue || '').trim();
      if (!value) continue;
      const key = value.toLowerCase();
      const current = counts.get(key) || { name: value, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }
  return [...counts.values()].sort((a, b) => (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  ));
}

export function CategoryFolderPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { library, isReady, hydrating } = useDb();
  const [search, setSearch] = useState('');
  const folder = FOLDERS[type];

  const values = useMemo(() => {
    if (!folder) return [];
    const list = countFolderValues(library, folder);
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((item) => item.name.toLowerCase().includes(needle));
  }, [folder, library, search]);

  if (hydrating) {
    return <div className="page empty-state">Restoring your library…</div>;
  }

  if (!isReady) {
    return <Navigate to="/" replace />;
  }

  if (!folder) {
    return <Navigate to="/library" replace />;
  }

  const openFolderValue = (value) => {
    const params = new URLSearchParams();
    params.set(folder.param, value);
    navigate(`/library?${params.toString()}`);
  };

  return (
    <div className="page source-page category-folder-page">
      <SourceAppChrome
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${folder.title.toLowerCase()}...`}
        showGridColumns={false}
      >
        <header className="category-folder-header">
          <h2>{folder.title}</h2>
          <p>{values.length} folder{values.length === 1 ? '' : 's'}</p>
        </header>

        {values.length === 0 ? (
          <div className="empty-state">No {folder.title.toLowerCase()} values found.</div>
        ) : (
          <ul className="category-folder-list">
            {values.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  className="category-folder-item"
                  onClick={() => openFolderValue(item.name)}
                >
                  <span>{item.name}</span>
                  <span>{item.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SourceAppChrome>
    </div>
  );
}
