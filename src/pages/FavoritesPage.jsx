import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { SkeletonGrid } from '../components/SkeletonGrid.jsx';
import { useDb } from '../context/DbContext.jsx';
import { useGridColumns } from '../hooks/useGridColumns.js';
import { applyLibraryFilters, formatDuration, getDurationMs, sortLibraryItems } from '../lib/libraryFilters.js';
import { gridColumnsClass } from '../lib/gridColumns.js';

export function FavoritesPage() {
  const { library, catalog, isReady, hydrating } = useDb();
  const [gridColumns] = useGridColumns();

  const items = useMemo(() => {
    if (!catalog) return [];
    return sortLibraryItems(
      applyLibraryFilters(library, {
        section: 'favorites',
        refreshSuccess: 'all',
        manifestHealth: 'all',
      }, catalog, {}),
      'newest',
      'favorites',
    );
  }, [catalog, library]);

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
      <section className="yt-section-head">
        <div>
          <h2>Favorites</h2>
          <p>{items.length} saved videos</p>
        </div>
      </section>

      {items.length ? (
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
                  item.genres?.[0],
                ]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state yt-empty-state">
          <strong>No favorites yet</strong>
          <span>Tap the heart on a watch page or long-press a card to save videos here.</span>
        </div>
      )}
    </div>
  );
}
