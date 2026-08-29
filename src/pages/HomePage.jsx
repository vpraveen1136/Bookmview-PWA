import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { SkeletonGrid } from '../components/SkeletonGrid.jsx';
import { useDb } from '../context/DbContext.jsx';
import { useGridColumns } from '../hooks/useGridColumns.js';
import { applyLibraryFilters, formatDuration, getDurationMs, sortLibraryItems } from '../lib/libraryFilters.js';
import { gridColumnsClass } from '../lib/gridColumns.js';

function sourceLabel(catalog, slug) {
  const source = catalog?.sources?.find((item) => item.slug === slug);
  return source?.display_name || slug;
}

export function HomePage() {
  const navigate = useNavigate();
  const { library, catalog, isReady, hydrating } = useDb();
  const [activeSource, setActiveSource] = useState('');
  const [gridColumns] = useGridColumns();

  const chips = useMemo(() => [
    { id: '', label: 'All' },
    ...(catalog?.sources || []).map((source) => ({
      id: source.slug,
      label: source.display_name || source.slug,
    })),
    { id: 'favorites', label: 'Favorites' },
    { id: 'unwatched', label: 'Unwatched' },
  ], [catalog]);

  const items = useMemo(() => {
    if (!catalog) return [];
    const filters = {
      section: activeSource === 'favorites' ? 'favorites' : 'videos',
      sources: activeSource && !['favorites', 'unwatched'].includes(activeSource) ? [activeSource] : [],
      read: activeSource === 'unwatched' ? false : undefined,
      refreshSuccess: 'all',
      manifestHealth: 'all',
    };
    return sortLibraryItems(applyLibraryFilters(library, filters, catalog, {}), 'newest', filters.section).slice(0, 80);
  }, [activeSource, catalog, library]);

  if (hydrating) {
    return (
      <div className="page youtube-page">
        <SkeletonGrid />
      </div>
    );
  }

  if (!isReady) return <Navigate to="/" replace />;

  return (
    <div className="page youtube-page">
      <div className="yt-chip-row" aria-label="Home filters">
        {chips.map((chip) => (
          <button
            key={chip.id || 'all'}
            type="button"
            className={`yt-chip ${activeSource === chip.id ? 'is-active' : ''}`}
            onClick={() => setActiveSource(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <section className="yt-section-head">
        <div>
          <h2>{activeSource ? chips.find((chip) => chip.id === activeSource)?.label : 'Home'}</h2>
          <p>{items.length} videos</p>
        </div>
        <button type="button" className="yt-text-btn" onClick={() => navigate('/library?refreshSuccess=all')}>
          View all
        </button>
      </section>

      {items.length ? (
        <ul className={`video-grid yt-video-feed ${gridColumnsClass(gridColumns)}`}>
          {items.map((item) => {
            const source = item.source_slug ? sourceLabel(catalog, item.source_slug) : null;
            return (
              <li key={item.tweet_id}>
                <BookmarkGridCard
                  item={item}
                  to={`/watch/${encodeURIComponent(item.tweet_id)}`}
                  duration={formatDuration(getDurationMs(item))}
                  sourceLabel={source}
                  subtitleParts={[
                    source,
                    item.studio,
                    item.casts?.[0],
                    item.genres?.[0],
                  ]}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state yt-empty-state">
          <strong>No videos found</strong>
          <span>Try another chip or load a newer database.</span>
        </div>
      )}
    </div>
  );
}
