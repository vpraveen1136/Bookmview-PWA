import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { useDb } from '../context/DbContext.jsx';
import { useGridColumns } from '../hooks/useGridColumns.js';
import { applyLibraryFilters, formatDuration, getDurationMs, sortLibraryItems } from '../lib/libraryFilters.js';
import { gridColumnsClass } from '../lib/gridColumns.js';

export function SearchPage() {
  const { library, catalog, isReady, hydrating } = useDb();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('videos');
  const [gridColumns] = useGridColumns();

  const items = useMemo(() => {
    if (!catalog || !query.trim()) return [];
    return sortLibraryItems(
      applyLibraryFilters(library, {
        section: scope === 'favorites' ? 'favorites' : 'videos',
        search: query,
        refreshSuccess: 'all',
        manifestHealth: 'all',
      }, catalog, {}),
      'newest',
      scope === 'favorites' ? 'favorites' : 'videos',
    );
  }, [catalog, library, query, scope]);

  if (hydrating) {
    return <div className="page youtube-page empty-state">Restoring search...</div>;
  }

  if (!isReady) return <Navigate to="/" replace />;

  return (
    <div className="page youtube-page search-page">
      <div className="yt-search-panel">
        <input
          className="yt-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search videos, cast, studio, genre..."
          autoFocus
          autoComplete="off"
        />
      </div>
      <div className="yt-chip-row" aria-label="Search scope">
        {[
          ['videos', 'Videos'],
          ['favorites', 'Favorites'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`yt-chip ${scope === id ? 'is-active' : ''}`}
            onClick={() => setScope(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {query.trim() ? (
        <section className="yt-section-head">
          <div>
            <h2>Results</h2>
            <p>{items.length} matches</p>
          </div>
        </section>
      ) : null}

      {!query.trim() ? (
        <div className="empty-state yt-empty-state">
          <strong>Search your library</strong>
          <span>Find videos by title, cast, studio, genre, or source.</span>
        </div>
      ) : items.length ? (
        <ul className={`video-grid yt-video-feed ${gridColumnsClass(gridColumns)}`}>
          {items.map((item) => (
            <li key={item.tweet_id}>
              <BookmarkGridCard
                item={item}
                to={`/watch/${encodeURIComponent(item.tweet_id)}`}
                duration={formatDuration(getDurationMs(item))}
                subtitleParts={[
                  catalog?.sources?.find((source) => source.slug === item.source_slug)?.display_name || item.source_slug,
                  item.studio,
                  item.casts?.[0],
                  item.genres?.[0],
                ]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state yt-empty-state">
          <strong>No matches</strong>
          <span>Try a shorter search or another spelling.</span>
        </div>
      )}
    </div>
  );
}
