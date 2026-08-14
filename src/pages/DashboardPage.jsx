import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { DefaultPlaybackModeSettings } from '../components/DefaultPlaybackModeSettings.jsx';
import { GridColumnToggle } from '../components/GridColumnToggle.jsx';
import { PrivacyEyeButton } from '../components/PrivacyEyeButton.jsx';
import { useDb } from '../context/DbContext.jsx';
import { usePlayability } from '../context/PlayabilityContext.jsx';
import { useGridColumns } from '../hooks/useGridColumns.js';
import { PLAYABILITY_BATCH } from '../lib/playabilityQueue.js';
import {
  formatDuration,
  getDurationMs,
} from '../lib/libraryFilters.js';
import { gridColumnsClass } from '../lib/gridColumns.js';
import { isNearScrollBottom, subscribeScroll } from '../lib/pageScroll.js';

export function DashboardPage() {
  const { catalog, isReady, fileName, hydrating } = useDb();
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const extendRequestedRef = useRef(false);
  const [gridColumns, setGridColumns] = useGridColumns();

  const items = discoveryBookmarks;
  const minDisplay = batch?.INITIAL_DISPLAY ?? PLAYABILITY_BATCH.INITIAL_DISPLAY;

  const checkingLabel = useMemo(() => {
    if (networkPaused) return 'Waiting for network…';
    const checked = Math.min(progress.done + (progress.checking || 0), progress.total);
    return `Checking ${checked} of ${progress.total}`;
  }, [networkPaused, progress]);

  const showQueue = items.length >= minDisplay || (!busy && items.length > 0);
  const showEarlyChecking = busy && items.length < minDisplay;

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
    if (!capPaused) {
      extendRequestedRef.current = false;
    }
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
    return <div className="page empty-state">Restoring your library…</div>;
  }

  if (!isReady) {
    return <Navigate to="/" replace />;
  }

  const showRunCheckHint = !busy && items.length === 0 && !hasCachedResults && eligibleCount > 0 && !hasMoreToProbe;

  const heroSub = busy
    ? `${items.length} playable · ${checkingLabel.toLowerCase()}`
    : capPaused && hasMoreToProbe
      ? `${items.length} playable · scroll for more`
      : `${items.length} playable`;

  return (
    <div className="page dashboard-page">
      <header className="library-hero library-hero-compact">
        <h2 className="library-brand">Dashboard</h2>
        <p className="library-hero-sub">
          {heroSub}
          {fileName ? <span className="db-hint-inline"> · {fileName}</span> : null}
        </p>
        <div className="library-hero-actions">
          <PrivacyEyeButton className="btn btn-icon" compact />
          <GridColumnToggle columns={gridColumns} onChange={setGridColumns} compact />
          <button
            type="button"
            className="btn btn-icon"
            onClick={shuffleDeck}
            aria-label="Shuffle discovery deck"
          >
            Shuffle
          </button>
          <button type="button" className="btn btn-icon" onClick={() => setSettingsOpen((v) => !v)} aria-label="Playback settings">
            Mode
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <div className="dashboard-settings">
          <DefaultPlaybackModeSettings />
        </div>
      ) : null}

      {showRunCheckHint ? (
        <div className="empty-state dashboard-check-hint">
          <p>No playable videos found.</p>
          <button type="button" className="btn btn-primary" onClick={runCheck}>
            Check again
          </button>
        </div>
      ) : null}

      {showEarlyChecking ? (
        <div className="empty-state playability-finding dashboard-checking">
          <p className="playability-finding-title">
            Finding playable videos…
            {items.length > 0 ? ` (${items.length} so far)` : ''}
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

      {!busy && items.length === 0 && hasCachedResults ? (
        <div className="empty-state">
          <p>No playable videos found.</p>
          <button type="button" className="btn" onClick={runCheck}>
            Check again
          </button>
        </div>
      ) : null}

      {showQueue ? (
        <ul className={`video-grid ${gridColumnsClass(gridColumns)}`}>
          {items.map((item) => {
            const duration = formatDuration(getDurationMs(item));
            const sourceLabel = item.source_slug && item.source_slug !== 'x'
              ? (catalog?.sources?.find((s) => s.slug === item.source_slug)?.display_name || item.source_slug)
              : null;
            return (
              <li key={item.tweet_id}>
                <BookmarkGridCard
                  item={item}
                  to={`/watch/${encodeURIComponent(item.tweet_id)}`}
                  duration={duration}
                  sourceLabel={sourceLabel}
                  statusBadge={{ label: 'Playable', className: 'play-status-dot-ok', text: '✓' }}
                  subtitleParts={[sourceLabel, 'Playable']}
                  onCheckPlayability={handleCheckPlayability}
                  checkingPlayability={checkingId === item.tweet_id}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
