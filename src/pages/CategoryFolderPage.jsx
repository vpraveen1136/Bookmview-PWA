import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { SourceAppChrome } from '../components/SourceAppChrome.jsx';
import { SkeletonGrid } from '../components/SkeletonGrid.jsx';
import { useDb } from '../context/DbContext.jsx';
import {
  CATEGORY_FOLDERS,
  buildFolderValues,
  formatSourceCounts,
} from '../lib/categoryFolders.js';

const SCROLL_KEY_PREFIX = 'bookmview.pwa.folderScroll.';

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

function firstLetter(value) {
  const char = String(value || '').trim().charAt(0).toUpperCase();
  return /^[A-Z0-9]$/.test(char) ? char : '#';
}

function availableLetters(values) {
  return [...new Set(values.map((item) => firstLetter(item.name)))].sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });
}

export function CategoryFolderPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { library, catalog, isReady, hydrating } = useDb();
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [letter, setLetter] = useState('');
  const folder = CATEGORY_FOLDERS[type];

  const allValues = useMemo(() => (
    folder ? buildFolderValues(library, catalog, folder) : []
  ), [catalog, folder, library]);

  const letters = useMemo(() => availableLetters(allValues), [allValues]);

  const values = useMemo(() => {
    let list = allValues;
    if (letter) list = list.filter((item) => firstLetter(item.name) === letter);
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((item) => (
      item.name.toLowerCase().includes(needle)
      || String(item.group_name || '').toLowerCase().includes(needle)
    ));
  }, [allValues, letter, search]);

  const castGroups = useMemo(() => (
    type === 'cast' ? groupCastValues(values) : []
  ), [type, values]);

  useEffect(() => {
    if (type !== 'cast') return;
    setOpenGroups(new Set(castGroups.map((group) => group.name)));
  }, [castGroups, type]);

  useEffect(() => {
    const key = `${SCROLL_KEY_PREFIX}${type || ''}`;
    const saved = Number(sessionStorage.getItem(key));
    if (Number.isFinite(saved) && saved > 0) {
      window.requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'auto' }));
    }
    const save = () => sessionStorage.setItem(key, String(window.scrollY || 0));
    window.addEventListener('pagehide', save);
    return () => {
      save();
      window.removeEventListener('pagehide', save);
    };
  }, [type]);

  if (hydrating) {
    return (
      <div className="page category-folder-page">
        <header className="category-folder-header">
          <h2>Restoring library</h2>
        </header>
        <SkeletonGrid />
      </div>
    );
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
    params.set('refreshSuccess', 'all');
    params.set('fromFolder', type);
    navigate(`/library?${params.toString()}`);
  };

  const toggleGroup = (groupName) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  return (
    <div className="page source-page category-folder-page">
      <SourceAppChrome
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${folder.title.toLowerCase()}...`}
        showGridColumns={false}
        leadingAction={{
          label: 'Back',
          ariaLabel: 'Go back',
          onClick: () => navigate(-1),
        }}
      >
        <nav className="folder-breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate('/x')}>Home</button>
          <span>/</span>
          <span>{folder.title}</span>
        </nav>

        <header className="category-folder-header">
          <div>
            <h2>{folder.title}</h2>
            <p>{values.length} tag{values.length === 1 ? '' : 's'} · {allValues.reduce((sum, item) => sum + Number(item.count || 0), 0)} videos</p>
          </div>
          {letter ? (
            <button type="button" className="btn btn-sm" onClick={() => setLetter('')}>All</button>
          ) : null}
        </header>

        {letters.length > 1 ? (
          <div className="folder-alphabet" aria-label={`${folder.title} alphabet`}>
            {letters.map((item) => (
              <button
                key={item}
                type="button"
                className={letter === item ? 'is-active' : ''}
                onClick={() => setLetter(letter === item ? '' : item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}

        {values.length === 0 ? (
          <div className="empty-state">
            No {folder.title.toLowerCase()} values found.
            <div className="empty-state-actions">
              <button type="button" className="btn" onClick={() => { setSearch(''); setLetter(''); }}>Show all</button>
            </div>
          </div>
        ) : type === 'cast' ? (
          <ul className="category-folder-list">
            {castGroups.map((group) => {
              const open = openGroups.has(group.name);
              return (
                <li key={group.name} className="category-folder-group">
                  <button
                    type="button"
                    className="category-folder-group-header"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.name)}
                  >
                    <span>{group.name}</span>
                    <span>{group.count}</span>
                  </button>
                  {open ? (
                    <ul className="category-folder-sublist">
                      {group.items.map((item) => (
                        <li key={`${group.name}-${item.name}`}>
                          <button
                            type="button"
                            className="category-folder-item"
                            onClick={() => openFolderValue(item.name)}
                          >
                            <span>{item.name}</span>
                            <small>{formatSourceCounts(item.sources, catalog)}</small>
                            <span>{item.count}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
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
                  <small>{formatSourceCounts(item.sources, catalog)}</small>
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
