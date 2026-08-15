import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';

import { BookmarkGridCard } from '../components/BookmarkGridCard.jsx';
import { SourceAppChrome } from '../components/SourceAppChrome.jsx';
import { useDb } from '../context/DbContext.jsx';
import { useSourceSearch } from '../hooks/useSourceSearch.js';
import { useGridColumns } from '../hooks/useGridColumns.js';
import {
  applyLibraryFilters,
  formatDuration,
  getDurationMs,
  sortLibraryItems,
} from '../lib/libraryFilters.js';
import { gridColumnsClass } from '../lib/gridColumns.js';
import { isSpankbangIframeEligible } from '../lib/spankbangEmbed.js';

const SPANKBANG_SLUG = 'spankbang';

export function SpankbangSourcePage() {
  const { library, catalog, isReady, hydrating } = useDb();
  const { search, setSearch } = useSourceSearch();
  const [gridColumns, setGridColumns] = useGridColumns();

  const spankbangLibrary = useMemo(
    () => (library || []).filter((item) => String(item.source_slug || '').toLowerCase() === SPANKBANG_SLUG),
    [library],
  );

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const matched = applyLibraryFilters(
      spankbangLibrary,
      {
        search,
        sources: [SPANKBANG_SLUG],
        section: 'videos',
        manifestHealth: 'all',
      },
      catalog,
      {},
    );
    return sortLibraryItems(matched, 'newest', 'videos');
  }, [catalog, search, spankbangLibrary]);

  if (hydrating) {
    return <div className="page empty-state">Restoring your library…</div>;
  }

  if (!isReady) {
    return <Navigate to="/" replace />;
  }

  const spankbangLabel = catalog?.sources?.find((s) => s.slug === SPANKBANG_SLUG)?.display_name || 'SPBG';

  return (
    <div className="page source-page">
      <SourceAppChrome
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search titles, genre, cast, studio…"
        gridColumns={gridColumns}
        onGridColumnsChange={setGridColumns}
      >
        <p className="source-page-sub">{filtered.length} {spankbangLabel} videos</p>

        {filtered.length === 0 ? (
          <div className="empty-state">
            {search ? 'No SpankBang videos match your search.' : 'No SpankBang bookmarks in this database.'}
          </div>
        ) : (
          <ul className={`video-grid ${gridColumnsClass(gridColumns)}`}>
            {filtered.map((item) => {
              const duration = formatDuration(getDurationMs(item));
              const embedReady = isSpankbangIframeEligible(item);
              return (
                <li key={item.tweet_id}>
                  <BookmarkGridCard
                    item={item}
                    to={`/watch/${encodeURIComponent(item.tweet_id)}`}
                    duration={duration}
                    sourceLabel={spankbangLabel}
                    statusBadge={embedReady
                      ? { label: 'Embed', className: 'play-status-dot-ok', text: '✓' }
                      : { label: 'No video id', className: 'play-status-dot-bad', text: '✕' }}
                    subtitleParts={[spankbangLabel, embedReady ? 'Embed' : 'Unresolved']}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </SourceAppChrome>
    </div>
  );
}
