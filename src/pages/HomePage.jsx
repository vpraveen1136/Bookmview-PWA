import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { SkeletonGrid } from '../components/SkeletonGrid.jsx';
import { useDb } from '../context/DbContext.jsx';
import { useGridColumns } from '../hooks/useGridColumns.js';
import { applyLibraryFilters, formatDuration, getDurationMs, sortLibraryItems } from '../lib/libraryFilters.js';
import { gridColumnsClass } from '../lib/gridColumns.js';

const HOME_BATCH_SIZE = 80;

function sourceLabel(catalog, slug) {
  const source = catalog?.sources?.find((item) => item.slug === slug);
  return source?.display_name || slug;
}

function seededSortValue(tweetId, seed) {
  const text = `${seed}:${tweetId || ''}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function HomePage() {
  const navigate = useNavigate();
  const { library, catalog, isReady, hydrating } = useDb();
  const [activeSource, setActiveSource] = useState('');
  const [gridColumns] = useGridColumns();
  const [displayCount, setDisplayCount] = useState(HOME_BATCH_SIZE);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartRef = useRef(null);
  const pullDistanceRef = useRef(0);

  const chips = useMemo(() => [
    { id: '', label: 'All' },
    ...(catalog?.sources || []).map((source) => ({
      id: source.slug,
      label: source.display_name || source.slug,
    })),
    { id: 'favorites', label: 'Favorites' },
    { id: 'unwatched', label: 'Unwatched' },
  ], [catalog]);

  useEffect(() => {
    setDisplayCount(HOME_BATCH_SIZE);
    setShuffleSeed(0);
  }, [activeSource]);

  const allItems = useMemo(() => {
    if (!catalog) return [];
    const filters = {
      section: activeSource === 'favorites' ? 'favorites' : 'videos',
      sources: activeSource && !['favorites', 'unwatched'].includes(activeSource) ? [activeSource] : [],
      read: activeSource === 'unwatched' ? false : undefined,
      refreshSuccess: 'all',
      manifestHealth: 'all',
    };
    const sorted = sortLibraryItems(applyLibraryFilters(library, filters, catalog, {}), 'newest', filters.section);
    if (!shuffleSeed) return sorted;
    return [...sorted].sort((left, right) => (
      seededSortValue(left.tweet_id, shuffleSeed) - seededSortValue(right.tweet_id, shuffleSeed)
    ));
  }, [activeSource, catalog, library, shuffleSeed]);

  const items = useMemo(() => allItems.slice(0, displayCount), [allItems, displayCount]);
  const hasMore = items.length < allItems.length;

  const shuffleHomeFeed = useCallback(() => {
    setRefreshing(true);
    setDisplayCount(HOME_BATCH_SIZE);
    setShuffleSeed(Date.now());
    window.setTimeout(() => {
      setRefreshing(false);
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }, 260);
  }, []);

  const onTouchStart = useCallback((event) => {
    if (window.scrollY > 2) return;
    touchStartRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchMove = useCallback((event) => {
    if (touchStartRef.current === null || window.scrollY > 2) return;
    const distance = (event.touches[0]?.clientY ?? 0) - touchStartRef.current;
    if (distance <= 0) return;
    const nextPullDistance = Math.min(96, distance * 0.45);
    pullDistanceRef.current = nextPullDistance;
    setPullDistance(nextPullDistance);
  }, []);

  const onTouchEnd = useCallback(() => {
    const shouldRefresh = pullDistanceRef.current >= 56;
    touchStartRef.current = null;
    if (shouldRefresh) {
      shuffleHomeFeed();
      return;
    }
    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, [shuffleHomeFeed]);

  if (hydrating) {
    return (
      <div className="page youtube-page">
        <SkeletonGrid />
      </div>
    );
  }

  if (!isReady) return <Navigate to="/" replace />;

  return (
    <div
      className="page youtube-page"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className={`yt-pull-refresh ${pullDistance || refreshing ? 'is-visible' : ''}`}
        style={{ transform: `translate(-50%, ${refreshing ? 56 : pullDistance}px)` }}
      >
        {refreshing ? 'Shuffling...' : 'Pull to shuffle'}
      </div>

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
          <p>
            {items.length} of {allItems.length} videos{shuffleSeed ? ' · shuffled' : ''}
          </p>
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

      {hasMore ? (
        <button
          type="button"
          className="yt-load-more"
          onClick={() => setDisplayCount((count) => count + HOME_BATCH_SIZE)}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
