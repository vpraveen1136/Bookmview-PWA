import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { SourceAppChrome } from '../components/SourceAppChrome.jsx';
import { ScrollPreviewProvider } from '../context/ScrollPreviewContext.jsx';
import { SkeletonGrid } from '../components/SkeletonGrid.jsx';
import { useDb } from '../context/DbContext.jsx';
import { usePlayability } from '../context/PlayabilityContext.jsx';
import { useGridColumns } from '../hooks/useGridColumns.js';
import { useSourceSearch } from '../hooks/useSourceSearch.js';
import { applyLibraryFilters, formatDuration, getDurationMs } from '../lib/libraryFilters.js';
import { gridColumnsClass } from '../lib/gridColumns.js';
import { isNearScrollBottom, subscribeScroll } from '../lib/pageScroll.js';
import { PLAYABILITY_BATCH } from '../lib/playabilityQueue.js';
import { scrollPreviewPrefetch } from '../lib/scrollPreviewPrefetch.js';

function isXBookmark(bookmark) {
  const slug = String(bookmark?.source_slug || 'x').trim().toLowerCase() || 'x';
  return slug === 'x';
}

export function XSourcePage() {
  const { catalog, isReady, hydrating } = useDb();
  const {
    discoveryBookmarks,
    progress,
    busy,
    networkPaused,
    capPaused,
    playableTargetCap,
    hasMoreToProbe,
    hasCachedResults,
    runCheck,
    checkPlayability,
    requestMorePlayables,
    shuffleDeck,
    eligibleCount,
    PLAYABILITY_BATCH: batch,
  } = usePlayability();
  const [searchParams] = useSearchParams();
  const { search, setSearch } = useSourceSearch();
  const [gridColumns, setGridColumns] = useGridColumns();
  const [checkingId, setCheckingId] = useState(null);
  const extendRequestedRef = useRef(false);

  const xDiscovery = useMemo(
    () => discoveryBookmarks.filter(isXBookmark),
    [discoveryBookmarks],
  );

  const items = useMemo(() => {
    if (!catalog) return xDiscovery;
    return applyLibraryFilters(
      xDiscovery,
      {
        search,
        sources: ['x'],
        manifestHealth: 'all',
        refreshSuccess: searchParams.get('refreshSuccess') || 'all',
        movieCast: searchParams.get('movieCast') || '',
        movieStudio: searchParams.get('movieStudio') || '',
        movieGenre: searchParams.get('movieGenre') || '',
      },
      catalog,
      {},
    );
  }, [catalog, search, searchParams, xDiscovery]);

  const minDisplay = batch?.INITIAL_DISPLAY ?? PLAYABILITY_BATCH.INITIAL_DISPLAY;
  const checkingLabel = useMemo(() => {
    if (networkPaused) return 'Waiting for network…';
    const checked = Math.min(progress.done + (progress.checking || 0), progress.total);
    return `Checking ${checked} of ${progress.total}`;
  }, [networkPaused, progress]);

  const showQueue = items.length >= minDisplay || (!busy && items.length > 0);
  const showEarlyChecking = busy && xDiscovery.length < minDisplay;
  const oneColumnFeed = gridColumns === 1;
  const scrollPreviewActive = showQueue && items.length > 0 && oneColumnFeed;

  useEffect(() => {
    if (!scrollPreviewActive) {
      scrollPreviewPrefetch.clear();
      return;
    }
    scrollPreviewPrefetch.setQueue(items);
  }, [items, scrollPreviewActive]);

  const handleCheckPlayability = async (item) => {
    const tweetId = item?.tweet_id;
    if (!tweetId) return;
    setCheckingId(tweetId);
    try {
      await checkPlayability(item);
    } finally {
      setCheckingId(null);
    }
  };

  useEffect(() => {
    if (!capPaused) extendRequestedRef.current = false;
  }, [capPaused]);

  useEffect(() => {
    const onScroll = () => {
      if (!capPaused || !hasMoreToProbe || extendRequestedRef.current) return;
      if (!isNearScrollBottom(96)) return;
      extendRequestedRef.current = true;
      requestMorePlayables();
    };
    return subscribeScroll(onScroll);
  }, [capPaused, hasMoreToProbe, requestMorePlayables]);

  if (hydrating) {
    return (
      <div className="page source-page">
        <SkeletonGrid />
      </div>
    );
  }

  if (!isReady) {
    return <Navigate to="/" replace />;
  }

  const showRunCheckHint = !busy && xDiscovery.length === 0 && !hasCachedResults && eligibleCount > 0 && !hasMoreToProbe;

  return (
    <ScrollPreviewProvider enabled={scrollPreviewActive}>
      <div className="page source-page">
      <SourceAppChrome
        search={search}
        onSearchChange={setSearch}
        gridColumns={gridColumns}
        onGridColumnsChange={setGridColumns}
      >
        <div className="source-page-meta">
          <p className="source-page-sub">
            {busy
              ? `${items.length} playable · ${checkingLabel.toLowerCase()}`
              : capPaused && hasMoreToProbe
                ? `${items.length} playable · scroll for more`
                : `${items.length} playable`}
          </p>
          <div className="source-page-actions">
            <button type="button" className="btn btn-sm" onClick={shuffleDeck}>
              Shuffle
            </button>
          </div>
        </div>

        {showRunCheckHint ? (
          <div className="empty-state dashboard-check-hint">
            <p>No playable X videos found.</p>
            <button type="button" className="btn btn-primary" onClick={runCheck}>
              Check again
            </button>
          </div>
        ) : null}

        {showEarlyChecking ? (
          <div className="empty-state playability-finding dashboard-checking">
            <p className="playability-finding-title">
              Finding playable videos…
              {xDiscovery.length > 0 ? ` (${xDiscovery.length} so far)` : ''}
            </p>
            <p className="playability-finding-sub">
              Queue opens after {minDisplay} playable videos · {checkingLabel}
            </p>
            <div className="playability-pulse" aria-hidden="true" />
          </div>
        ) : null}

        {busy && showQueue ? (
          <p className="playability-banner muted" role="status">
            {networkPaused
              ? 'Network paused — retrying…'
              : `${checkingLabel} — building queue (up to ${playableTargetCap})`}
          </p>
        ) : null}

        {capPaused && hasMoreToProbe && showQueue ? (
          <p className="playability-banner muted" role="status">
            Showing {items.length} playable · scroll to the bottom for the next {batch.EXTEND}
          </p>
        ) : null}

        {!busy && xDiscovery.length === 0 && hasCachedResults ? (
          <div className="empty-state">
            <p>No playable X videos found.</p>
            <button type="button" className="btn" onClick={runCheck}>
              Check again
            </button>
          </div>
        ) : null}

        {showQueue && items.length > 0 ? (
          <ul className={`video-grid ${gridColumnsClass(gridColumns)}`}>
            {items.map((item) => {
              const duration = formatDuration(getDurationMs(item));
              return (
                <li key={item.tweet_id}>
                  <BookmarkGridCard
                    item={item}
                    to={`/watch/${encodeURIComponent(item.tweet_id)}`}
                    duration={duration}
                    statusBadge={{ label: 'Playable', className: 'play-status-dot-ok', text: '✓' }}
                    subtitleParts={['Playable']}
                    onCheckPlayability={handleCheckPlayability}
                    checkingPlayability={checkingId === item.tweet_id}
                    scrollPreviewEnabled={oneColumnFeed}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}

        {showQueue && items.length === 0 && search ? (
          <div className="empty-state">No X videos match your search.</div>
        ) : null}
      </SourceAppChrome>
    </div>
    </ScrollPreviewProvider>
  );
}
