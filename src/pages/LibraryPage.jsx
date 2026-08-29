import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { AppSlideMenu } from '../components/AppSlideMenu.jsx';
import { FilterSheet, LibraryFilterPanel } from '../components/LibraryFilterSheet.jsx';
import { GridColumnToggle } from '../components/GridColumnToggle.jsx';
import { PrivacyEyeButton } from '../components/PrivacyEyeButton.jsx';
import { useDb } from '../context/DbContext.jsx';
import { usePlayability } from '../context/PlayabilityContext.jsx';
import { usePrivacy } from '../context/PrivacyContext.jsx';
import { useGridColumns } from '../hooks/useGridColumns.js';
import {
  FilterChips,
  LibrarySectionTabs,
  useLibraryFilters,
} from '../hooks/useLibraryFilters.jsx';
import {
  applyLibraryFilters,
  formatDuration,
  getDurationMs,
  sortLibraryItems,
} from '../lib/libraryFilters.js';
import { getBookmarkDisplayTitle, getBookmarkThumbnailUrl } from '../lib/playback.js';
import { gridColumnsClass } from '../lib/gridColumns.js';
import { listContinueWatching } from '../lib/watchPlaybackPosition.js';

function statusMeta(status, PLAYABILITY) {
  if (status === PLAYABILITY.PLAYABLE) {
    return { label: 'Playable', className: 'play-status-dot-ok', text: '✓' };
  }
  if (status === PLAYABILITY.NON_PLAYABLE || status === PLAYABILITY.EXPIRED) {
    return { label: 'Not playable', className: 'play-status-dot-bad', text: '✕' };
  }
  if (status === PLAYABILITY.CHECKING) {
    return { label: 'Checking', className: 'play-status-dot-busy', text: '◌' };
  }
  return { label: 'Unknown', className: 'play-status-dot-unknown', text: '?' };
}

export function LibraryPage() {
  const { library, catalog, isReady, fileName, hydrating } = useDb();
  const { getStatus, checkPlayability, PLAYABILITY, progress, busy } = usePlayability();
  const { contentHidden } = usePrivacy();
  const [searchParams] = useSearchParams();
  const libraryQuery = searchParams.toString();
  const { filters, patchFilters, setSection, clearFilters, activeCount } = useLibraryFilters();
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gridColumns, setGridColumns] = useGridColumns();
  const [checkingId, setCheckingId] = useState(null);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const matched = applyLibraryFilters(library, { ...filters, manifestHealth: 'all' }, catalog, {});
    return sortLibraryItems(matched, filters.sort, filters.section);
  }, [catalog, filters, library]);

  const continueWatching = useMemo(
    () => listContinueWatching(library, { limit: 8 }),
    [library],
  );

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

  if (hydrating) {
    return (
      <div className="page empty-state">Restoring your library…</div>
    );
  }

  if (!isReady) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page library-page">
      <header className="library-hero library-hero-compact">
        <h2 className="library-brand">Library</h2>
        <p className="library-hero-sub">
          {filtered.length} videos
          {fileName ? <span className="db-hint-inline"> · {fileName}</span> : null}
          {busy ? (
            <span className="db-hint-inline">
              {' '}
              · checking {Math.min(progress.done + (progress.checking || 0), progress.total)}/{progress.total}
            </span>
          ) : null}
        </p>
        <div className="library-hero-actions">
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <PrivacyEyeButton className="btn btn-icon" compact />
          <GridColumnToggle columns={gridColumns} onChange={setGridColumns} compact />
        </div>
      </header>

      {continueWatching.length > 0 && filters.section === 'videos' && !filters.search ? (
        <section className="library-continue">
          <h3 className="library-section-title">Continue watching</h3>
          <ul className="continue-row">
            {continueWatching.map((item) => (
              <li key={item.tweet_id}>
                <Link
                  className="continue-card"
                  to={{
                    pathname: `/watch/${encodeURIComponent(item.tweet_id)}`,
                    search: libraryQuery,
                  }}
                >
                  {contentHidden ? (
                    <div className="continue-card-placeholder privacy-placeholder" aria-hidden="true" />
                  ) : getBookmarkThumbnailUrl(item) ? (
                    <img src={getBookmarkThumbnailUrl(item)} alt="" loading="lazy" />
                  ) : (
                    <div className="continue-card-placeholder" />
                  )}
                  <span className={`continue-card-title ${contentHidden ? 'privacy-hidden-text' : ''}`}>
                    {contentHidden ? '···' : getBookmarkDisplayTitle(item)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <LibrarySectionTabs section={filters.section} onChange={setSection} />

      <div className="toolbar">
        <input
          className="search-input toolbar-search"
          type="search"
          placeholder="Search titles, authors, genre, cast, studio…"
          value={filters.search}
          onChange={(event) => patchFilters({ search: event.target.value })}
          autoComplete="off"
          enterKeyHint="search"
        />
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setFilterOpen(true)}
            aria-label="Open filters"
          >
            Filters
            {activeCount > 0 ? <span className="badge">{activeCount}</span> : null}
          </button>
        </div>
      </div>

      <FilterChips
        filters={filters}
        catalog={catalog}
        onPatch={patchFilters}
        onClear={clearFilters}
      />

      {filtered.length === 0 ? (
        <div className="empty-state">
          No videos match this section and filters.
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn" onClick={clearFilters}>Reset filters</button>
          </div>
        </div>
      ) : (
        <ul className={`video-grid ${gridColumnsClass(gridColumns)}`}>
          {filtered.map((item) => {
            const duration = formatDuration(getDurationMs(item));
            const sourceLabel = item.source_slug && item.source_slug !== 'x'
              ? (catalog?.sources?.find((s) => s.slug === item.source_slug)?.display_name || item.source_slug)
              : null;
            const status = getStatus(item.tweet_id);
            const badge = statusMeta(status, PLAYABILITY);
            return (
              <li key={item.tweet_id}>
                <BookmarkGridCard
                  item={item}
                  to={{
                    pathname: `/watch/${encodeURIComponent(item.tweet_id)}`,
                    search: libraryQuery,
                  }}
                  duration={duration}
                  sourceLabel={sourceLabel}
                  statusBadge={badge}
                  subtitleParts={[sourceLabel, badge.label, item.is_read ? 'Watched' : null]}
                  onCheckPlayability={handleCheckPlayability}
                  checkingPlayability={checkingId === item.tweet_id || status === PLAYABILITY.CHECKING}
                />
              </li>
            );
          })}
        </ul>
      )}

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        <LibraryFilterPanel
          filters={filters}
          catalog={catalog}
          onChange={(patch) => patchFilters(patch)}
          onClear={() => {
            clearFilters();
            setFilterOpen(false);
          }}
        />
      </FilterSheet>
      <AppSlideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
