import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { DefaultPlaybackModeSettings } from './DefaultPlaybackModeSettings.jsx';

export function FilterSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const sheet = (
    <div className="sheet-root sheet-root-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sheet-backdrop" aria-label="Close filters" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">{title}</h2>
            <p className="sheet-subtitle">Same filters as desktop library</p>
          </div>
          <button type="button" className="btn sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

function FilterGroup({ label, children }) {
  return (
    <section className="filter-group">
      <h3 className="filter-label">{label}</h3>
      {children}
    </section>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button type="button" className={`pill ${active ? 'pill-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function SelectControl({ value, onChange, children, id }) {
  return (
    <select id={id} className="select-control" value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

export function LibraryFilterPanel({ filters, catalog, onChange, onClear }) {
  const toggleTag = (tagId) => {
    const set = new Set(filters.tagIds ?? []);
    if (set.has(tagId)) set.delete(tagId);
    else set.add(tagId);
    onChange({ tagIds: [...set] });
  };

  const toggleSource = (slug) => {
    const set = new Set(filters.sources ?? []);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    onChange({ sources: [...set] });
  };

  const toggleRead = (value) => {
    onChange({ read: filters.read === value ? undefined : value });
  };

  return (
    <>
      <FilterGroup label="Last refresh">
        <div className="pill-row">
          <Pill
            active={filters.refreshSuccess === 'last'}
            onClick={() => onChange({ refreshSuccess: 'last' })}
          >
            Successful only
          </Pill>
          <Pill
            active={!filters.refreshSuccess || filters.refreshSuccess === 'all'}
            onClick={() => onChange({ refreshSuccess: 'all' })}
          >
            All videos
          </Pill>
        </div>
        <p className="filter-hint">
          Successful only = that bookmark’s last refresh succeeded or the URL was already active.
          Failed refreshes are excluded from playability checks (per video, not only the latest tray session).
          Re-export the database after refreshing on desktop.
        </p>
      </FilterGroup>

      <FilterGroup label="Watch status">
        <div className="pill-row">
          <Pill active={filters.read === true} onClick={() => toggleRead(true)}>Watched</Pill>
          <Pill active={filters.read === false} onClick={() => toggleRead(false)}>Unwatched</Pill>
        </div>
      </FilterGroup>

      <FilterGroup label="Sources">
        <div className="pill-row">
          <Pill
            active={!(filters.sources ?? []).length}
            onClick={() => onChange({ sources: [] })}
          >
            All
          </Pill>
          {(catalog?.sources ?? []).map((s) => (
            <Pill
              key={s.slug}
              active={(filters.sources ?? []).includes(s.slug)}
              onClick={() => toggleSource(s.slug)}
            >
              {s.display_name || s.slug}
            </Pill>
          ))}
        </div>
        <p className="filter-hint">Select one or more sources. Empty selection means all.</p>
      </FilterGroup>

      <FilterGroup label="Author">
        <SelectControl
          id="filter-author"
          value={filters.author || ''}
          onChange={(author) => onChange({ author })}
        >
          <option value="">Any author</option>
          {(catalog?.authors ?? []).map((a) => (
            <option key={a.user_id} value={a.user_id}>
              {a.display_name || a.username || a.user_id}
            </option>
          ))}
        </SelectControl>
      </FilterGroup>

      <FilterGroup label="Playlist">
        <SelectControl
          id="filter-playlist"
          value={filters.playlistId || ''}
          onChange={(playlistId) => onChange({ playlistId })}
        >
          <option value="">Any playlist</option>
          {(catalog?.playlists ?? []).map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}</option>
          ))}
        </SelectControl>
      </FilterGroup>

      <FilterGroup label="Tags">
        <div className="pill-row pill-row-scroll">
          {(catalog?.tags ?? []).length ? (catalog.tags).map((tag) => (
            <Pill
              key={tag.id}
              active={(filters.tagIds ?? []).includes(tag.id)}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.name}
            </Pill>
          )) : (
            <span className="muted-text">No tags in database</span>
          )}
        </div>
      </FilterGroup>

      <FilterGroup label="Date added">
        <SelectControl
          id="filter-date"
          value={filters.dateAdded || 'any'}
          onChange={(dateAdded) => onChange({ dateAdded })}
        >
          <option value="any">Any time</option>
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="last_year">Last year</option>
        </SelectControl>
      </FilterGroup>

      {(catalog?.genreOptions?.length > 0) ? (
        <FilterGroup label="Genre">
          <SelectControl
            id="filter-genre"
            value={filters.movieGenre || ''}
            onChange={(movieGenre) => onChange({ movieGenre })}
          >
            <option value="">Any genre</option>
            {catalog.genreOptions.map((g) => (
              <option key={g.name} value={g.name}>{g.name}</option>
            ))}
          </SelectControl>
        </FilterGroup>
      ) : null}

      {(catalog?.moodOptions?.length > 0) ? (
        <FilterGroup label="Mood">
          <SelectControl
            id="filter-mood"
            value={filters.movieMood || ''}
            onChange={(movieMood) => onChange({ movieMood })}
          >
            <option value="">Any mood</option>
            {catalog.moodOptions.map((m) => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </SelectControl>
        </FilterGroup>
      ) : null}

      {(catalog?.castOptions?.length > 0) ? (
        <FilterGroup label="Cast">
          <SelectControl
            id="filter-cast"
            value={filters.movieCast || ''}
            onChange={(movieCast) => onChange({ movieCast })}
          >
            <option value="">Any cast</option>
            {catalog.castOptions.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </SelectControl>
        </FilterGroup>
      ) : null}

      {(catalog?.industryOptions?.length > 0) ? (
        <FilterGroup label="Region / industry">
          <SelectControl
            id="filter-region"
            value={filters.movieRegion || ''}
            onChange={(movieRegion) => onChange({ movieRegion })}
          >
            <option value="">Any</option>
            {catalog.industryOptions.map((i) => (
              <option key={i.name} value={i.name}>{i.name}</option>
            ))}
          </SelectControl>
        </FilterGroup>
      ) : null}

      {(catalog?.studioOptions?.length > 0) ? (
        <FilterGroup label="Studio">
          <SelectControl
            id="filter-studio"
            value={filters.movieStudio || ''}
            onChange={(movieStudio) => onChange({ movieStudio })}
          >
            <option value="">Any studio</option>
            {catalog.studioOptions.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </SelectControl>
        </FilterGroup>
      ) : null}

      {(catalog?.decadeOptions?.length > 0) ? (
        <FilterGroup label="Decade">
          <SelectControl
            id="filter-decade"
            value={filters.movieDecade || ''}
            onChange={(movieDecade) => onChange({ movieDecade })}
          >
            <option value="">Any decade</option>
            {catalog.decadeOptions.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </SelectControl>
        </FilterGroup>
      ) : null}

      <FilterGroup label="Sort by">
        <SelectControl
          id="filter-sort"
          value={filters.sort || 'newest'}
          onChange={(sort) => onChange({ sort })}
        >
          <option value="newest">Latest</option>
          <option value="oldest">Oldest</option>
          <option value="last_viewed">Recently watched</option>
          <option value="duration">Duration (longest)</option>
          <option value="duration_asc">Duration (shortest)</option>
          <option value="rating_desc">Rating (highest)</option>
          <option value="rating_asc">Rating (lowest)</option>
        </SelectControl>
      </FilterGroup>

      <DefaultPlaybackModeSettings />

      <button type="button" className="btn btn-block" onClick={onClear}>
        Reset all filters
      </button>
    </>
  );
}
