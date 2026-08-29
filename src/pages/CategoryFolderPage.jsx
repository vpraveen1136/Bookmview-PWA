import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { SourceAppChrome } from '../components/SourceAppChrome.jsx';
import { useDb } from '../context/DbContext.jsx';

const FOLDERS = {
  cast: {
    title: 'Cast',
    param: 'movieCast',
    optionsKey: 'castOptions',
    valuesFor: (bookmark) => bookmark.casts ?? [],
  },
  studio: {
    title: 'Studio',
    param: 'movieStudio',
    optionsKey: 'studioOptions',
    valuesFor: (bookmark) => (bookmark.studio ? [bookmark.studio] : []),
  },
  genre: {
    title: 'Genre',
    param: 'movieGenre',
    optionsKey: 'genreOptions',
    valuesFor: (bookmark) => bookmark.genres ?? [],
  },
};

function countAssignedValues(library, folder) {
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
  return counts;
}

function buildFolderValues(library, catalog, folder) {
  const assigned = countAssignedValues(library, folder);
  const merged = new Map();
  const options = catalog?.[folder.optionsKey] ?? [];

  for (const option of options) {
    const name = String(option.name || '').trim();
    if (!name) continue;
    const key = `${option.group_id ?? ''}::${name.toLowerCase()}`;
    merged.set(key, {
      ...option,
      name,
      count: Number(assigned.get(name.toLowerCase())?.count ?? 0),
    });
  }

  for (const item of assigned.values()) {
    const hasOption = [...merged.values()].some((option) => option.name.toLowerCase() === item.name.toLowerCase());
    if (!hasOption) {
      merged.set(`assigned::${item.name.toLowerCase()}`, item);
    }
  }

  return [...merged.values()].sort((a, b) => (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  ));
}

function groupCastValues(values) {
  const groups = new Map();
  for (const item of values) {
    const groupName = item.group_name || 'Other';
    const group = groups.get(groupName) || { name: groupName, count: 0, items: [] };
    group.count += Number(item.count || 0);
    group.items.push(item);
    groups.set(groupName, group);
  }
  return [...groups.values()].sort((a, b) => (
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  ));
}

export function CategoryFolderPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { library, catalog, isReady, hydrating } = useDb();
  const [search, setSearch] = useState('');
  const folder = FOLDERS[type];

  const values = useMemo(() => {
    if (!folder) return [];
    const list = buildFolderValues(library, catalog, folder);
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((item) => (
      item.name.toLowerCase().includes(needle)
      || String(item.group_name || '').toLowerCase().includes(needle)
    ));
  }, [catalog, folder, library, search]);

  const castGroups = useMemo(() => (
    type === 'cast' ? groupCastValues(values) : []
  ), [type, values]);

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
          <p>{values.length} tag{values.length === 1 ? '' : 's'}</p>
        </header>

        {values.length === 0 ? (
          <div className="empty-state">No {folder.title.toLowerCase()} values found.</div>
        ) : (
          type === 'cast' ? (
            <ul className="category-folder-list">
              {castGroups.map((group) => (
                <li key={group.name} className="category-folder-group">
                  <div className="category-folder-group-header">
                    <span>{group.name}</span>
                    <span>{group.count}</span>
                  </div>
                  <ul className="category-folder-sublist">
                    {group.items.map((item) => (
                      <li key={`${group.name}-${item.name}`}>
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
                </li>
              ))}
            </ul>
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
          )
        )}
      </SourceAppChrome>
    </div>
  );
}
