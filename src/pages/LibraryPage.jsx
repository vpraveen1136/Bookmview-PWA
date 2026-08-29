import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { FilterSheet, LibraryFilterPanel } from '../components/LibraryFilterSheet.jsx';
import { GridColumnToggle } from '../components/GridColumnToggle.jsx';
import { SkeletonGrid } from '../components/SkeletonGrid.jsx';
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
import { getActiveCategoryFilter } from '../lib/categoryFolders.js';

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
  const navigate = useNavigate();
  const { library, catalog, isReady, hydrating } = useDb();
  const { getStatus, checkPlayability, PLAYABILITY, progress, busy } = usePlayability();
  const { contentHidden } = usePrivacy();
  const [searchParams] = useSearchParams();
  const libraryQuery = searchParams.toString();
  const { filters, patchFilters, setSection, clearFilters, activeCount } = useLibraryFilters();
  const [filterOpen, setFilterOpen] = useState(false);
  const [gridColumns, setGridColumns] = useGridColumns();
  const [checkingId, setCheckingId] = useState(null);
  const fromFolder = searchParams.get('fromFolder') || '';
  const activeCategory = getActiveCategoryFilter(searchParams);
  const folderBackPath = activeCategory
    ? `/folders/${activeCategory.folder.id}`
    : ['cast', 'studio', 'genre'].includes(fromFolder)
      ? `/folders/${fromFolder}`
      : '';
  const pageTitle = activeCategory
    ? `${activeCategory.folder.title}: ${activeCategory.value}`
    : 'Library';
  const filtered = useMemo(() => {
    if (!catalog) return [];
    const matched = applyLibraryFilters(library, { ...filters, manifestHealth: 'all' }, catalog, {});
    return sortLibraryItems(matched, filters.sort, filters.section);
  }, [catalog, filters, library]);
  const sourceFilteredCounts = useMemo(() => {
    if (!catalog || !activeCategory) return new Map();
    const baseFilters = {
      ...filters,
      sources: [],
      manifestHealth: 'all',
      refreshSuccess: filters.refreshSuccess || 'all',
    };
    const rows = applyLibraryFilters(library, baseFilters, catalog, {});
    const counts = new Map();
    for (const item of rows) {
      const slug = String(item.source_slug || 'x').toLowerCase() || 'x';
      counts.set(slug, (counts.get(slug) || 0) + 1);
    }
    return counts;
  }, [activeCategory, catalog, filters, library]);
  const allSourceFilteredCount = useMemo(() => (
    [...sourceFilteredCounts.values()].reduce((sum, count) => sum + count, 0)
  ), [sourceFilteredCounts]);
  const featuredRows = activeCategory ? filtered.slice(0, 8) : [];
  const continueFiltered = useMemo(
    () => (activeCategory ? listContinueWatching(filtered, { limit: 8 }) : []),
    [activeCategory, filtered],
  );
  const clearCategoryFilter = () => {
    if (!activeCategory) return;
    patchFilters({ [activeCategory.folder.param]: '', refreshSuccess: 'all' });
  };
  const toggleSourceFilter = (slug) => {
    patchFilters({ sources: slug ? [slug] : [], refreshSuccess: 'all' });
  };

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
      <div className="page library-page">
        <header className="library-hero library-hero-compact">
          <h2 className="library-brand">Restoring library</h2>
        </header>
        <SkeletonGrid />
      </div>
    );
  }

  if (!isReady) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page library-page">
      <header className="library-hero library-hero-compact">
        {activeCategory ? (
          <nav className="folder-breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => navigate('/x')}>Home</button>
            <span>/</span>
            <button type="button" onClick={() => navigate(folderBackPath)}>{activeCategory.folder.title}</button>
            <span>/</span>
            <span>{activeCategory.value}</span>
          </nav>
        ) : null}
        <h2 className="library-brand">{pageTitle}</h2>
        <p className="library-hero-sub">
          {filtered.length} videos
          {busy ? (
            <span className="db-hint-inline">
              {' '}
              · checking {Math.min(progress.done + (progress.checking || 0), progress.total)}/{progress.total}
            </span>
          ) : null}
        </p>
        <div className="library-hero-actions">
          {folderBackPath ? (
            <button
              type="button"
              className="btn btn-icon"
              aria-label="Back to folder"
              onClick={() => navigate(folderBackPath)}
            >
              Back
            </button>
          ) : null}
          {activeCategory ? (
            <button
              type="button"
              className="btn btn-icon"
              aria-label="Clear category filter"
              onClick={clearCategoryFilter}
            >
              Clear
            </button>
          ) : null}
          <GridColumnToggle columns={gridColumns} onChange={setGridColumns} compact />
        </div>
      </header>

      {continueFiltered.length > 0 ? (
        <section className="library-continue">
          <h3 className="library-section-title">Continue watching</h3>
          <ul className="continue-row">
            {continueFiltered.map((item) => (
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
                    {contentHidden ? '...' : getBookmarkDisplayTitle(item)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : continueWatching.length > 0 && filters.section === 'videos' && !filters.search ? (
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

      <div className="yt-library-sticky">
        <LibrarySectionTabs section={filters.section} onChange={setSection} />
        {activeCategory ? (
          <div className="source-filter-row" aria-label="Source filters">
            <button
              type="button"
              className={`source-filter-pill${!(filters.sources ?? []).length ? ' is-active' : ''}`}
              onClick={() => toggleSourceFilter('')}
            >
              All <span>{allSourceFilteredCount}</span>
            </button>
            {(catalog?.sources ?? []).map((source) => (
              <button
                key={source.slug}
                type="button"
                className={`source-filter-pill${(filters.sources ?? []).includes(source.slug) ? ' is-active' : ''}`}
                onClick={() => toggleSourceFilter(source.slug)}
              >
                {source.display_name || source.slug}
                <span>{sourceFilteredCounts.get(String(source.slug).toLowerCase()) || 0}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="toolbar yt-library-toolbar">
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
          <select
            className="sort-select"
            value={filters.sort || 'newest'}
            onChange={(event) => patchFilters({ sort: event.target.value })}
            aria-label="Sort videos"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="duration">Duration</option>
            <option value="duration_asc">Shortest</option>
            <option value="rating_desc">Rating</option>
          </select>
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
        <div className="empty-state yt-empty-state">
          <strong>No videos found</strong>
          <span>Try another section, clear filters, or browse folders.</span>
          <div className="empty-state-actions">
            {folderBackPath ? (
              <button type="button" className="btn" onClick={() => navigate(folderBackPath)}>Back to folder</button>
            ) : null}
            <button type="button" className="btn" onClick={clearFilters}>Reset filters</button>
          </div>
        </div>
      ) : (
        <>
          {featuredRows.length > 0 ? (
            <section className="library-continue">
              <h3 className="library-section-title">Recently added</h3>
              <ul className="continue-row">
                {featuredRows.map((item) => (
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
                        {contentHidden ? '...' : getBookmarkDisplayTitle(item)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <h3 className="library-section-title">All videos</h3>
          <ul className={`video-grid yt-video-feed ${gridColumnsClass(gridColumns)}`}>
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
        </>
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
    </div>
  );
}
