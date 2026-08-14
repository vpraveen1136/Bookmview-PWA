import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  DEFAULT_LIBRARY_FILTERS,
  countActiveFilters,
} from '../lib/libraryFilters.js';

function parseFilters(searchParams) {
  const readParam = searchParams.get('read');
  let read;
  if (readParam === 'true') read = true;
  else if (readParam === 'false') read = false;

  const tagIds = (searchParams.get('tags') || '')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  const sourcesParam = searchParams.get('sources') || '';
  const legacySource = searchParams.get('source') || '';
  const sources = (sourcesParam || legacySource)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    ...DEFAULT_LIBRARY_FILTERS,
    section: searchParams.get('section') || 'videos',
    search: searchParams.get('search') || '',
    sources,
    author: searchParams.get('author') || '',
    read,
    dateAdded: searchParams.get('dateAdded') || 'any',
    tagIds,
    playlistId: searchParams.get('playlist') || '',
    sort: searchParams.get('sort') || 'newest',
    movieGenre: searchParams.get('movieGenre') || '',
    movieMood: searchParams.get('movieMood') || '',
    movieCast: searchParams.get('movieCast') || '',
    movieRegion: searchParams.get('movieRegion') || '',
    movieStudio: searchParams.get('movieStudio') || '',
    movieDecade: searchParams.get('movieDecade') || '',
    manifestHealth: searchParams.get('manifestHealth') || 'all',
    refreshSuccess: searchParams.get('refreshSuccess') || 'last',
  };
}

function filtersToParams(filters) {
  const params = new URLSearchParams();
  if (filters.section && filters.section !== 'videos') params.set('section', filters.section);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.sources?.length) params.set('sources', filters.sources.join(','));
  if (filters.author) params.set('author', filters.author);
  if (filters.read === true) params.set('read', 'true');
  if (filters.read === false) params.set('read', 'false');
  if (filters.dateAdded && filters.dateAdded !== 'any') params.set('dateAdded', filters.dateAdded);
  if (filters.tagIds?.length) params.set('tags', filters.tagIds.join(','));
  if (filters.playlistId) params.set('playlist', filters.playlistId);
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.movieGenre) params.set('movieGenre', filters.movieGenre);
  if (filters.movieMood) params.set('movieMood', filters.movieMood);
  if (filters.movieCast) params.set('movieCast', filters.movieCast);
  if (filters.movieRegion) params.set('movieRegion', filters.movieRegion);
  if (filters.movieStudio) params.set('movieStudio', filters.movieStudio);
  if (filters.movieDecade) params.set('movieDecade', filters.movieDecade);
  if (filters.manifestHealth && filters.manifestHealth !== 'all') {
    params.set('manifestHealth', filters.manifestHealth);
  }
  if (filters.refreshSuccess && filters.refreshSuccess !== 'last') {
    params.set('refreshSuccess', filters.refreshSuccess);
  }
  return params;
}

export function useLibraryFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const patchFilters = (patch) => {
    const next = { ...filters, ...patch };
    setSearchParams(filtersToParams(next), { replace: true });
  };

  const setSection = (section) => {
    patchFilters({ section });
  };

  const clearFilters = () => {
    setSearchParams(filtersToParams({ ...DEFAULT_LIBRARY_FILTERS, section: filters.section }), { replace: true });
  };

  return { filters, patchFilters, setSection, clearFilters, activeCount };
}

export function FilterChips({ filters, catalog, onPatch, onClear }) {
  const chips = useMemo(() => {
    const list = [];
    if (filters.search?.trim()) {
      list.push({
        key: 'search',
        label: `Search: ${filters.search.trim()}`,
        clear: { search: '' },
      });
    }
    if (filters.sources?.length) {
      for (const slug of filters.sources) {
        const src = catalog?.sources?.find((s) => s.slug === slug);
        list.push({
          key: `source-${slug}`,
          label: src?.display_name || slug,
          clear: { sources: (filters.sources ?? []).filter((id) => id !== slug) },
        });
      }
    }
    if (filters.author) {
      const author = catalog?.authors?.find((a) => a.user_id === filters.author);
      list.push({ key: 'author', label: author?.display_name || author?.username || 'Author', clear: { author: '' } });
    }
    if (filters.read === true) list.push({ key: 'read', label: 'Watched', clear: { read: undefined } });
    if (filters.read === false) list.push({ key: 'read', label: 'Unwatched', clear: { read: undefined } });
    if (filters.dateAdded && filters.dateAdded !== 'any') {
      list.push({ key: 'date', label: filters.dateAdded.replace(/_/g, ' '), clear: { dateAdded: 'any' } });
    }
    for (const tagId of filters.tagIds ?? []) {
      const tag = catalog?.tags?.find((t) => t.id === tagId);
      list.push({
        key: `tag-${tagId}`,
        label: tag?.name || `Tag ${tagId}`,
        clear: { tagIds: (filters.tagIds ?? []).filter((id) => id !== tagId) },
      });
    }
    if (filters.playlistId) {
      const pl = catalog?.playlists?.find((p) => String(p.id) === String(filters.playlistId));
      list.push({ key: 'playlist', label: pl?.name || 'Playlist', clear: { playlistId: '' } });
    }
    if (filters.movieGenre) list.push({ key: 'genre', label: filters.movieGenre, clear: { movieGenre: '' } });
    if (filters.movieMood) list.push({ key: 'mood', label: filters.movieMood, clear: { movieMood: '' } });
    if (filters.movieCast) list.push({ key: 'cast', label: filters.movieCast, clear: { movieCast: '' } });
    if (filters.movieRegion) list.push({ key: 'region', label: filters.movieRegion, clear: { movieRegion: '' } });
    if (filters.movieStudio) list.push({ key: 'studio', label: filters.movieStudio, clear: { movieStudio: '' } });
    if (filters.movieDecade) list.push({ key: 'decade', label: filters.movieDecade, clear: { movieDecade: '' } });
    if (filters.manifestHealth && filters.manifestHealth !== 'all') {
      const labels = {
        active: 'Playable (m3u8)',
        stale: 'Not playable',
        unchecked: 'm3u8 not checked',
      };
      list.push({
        key: 'manifestHealth',
        label: labels[filters.manifestHealth] || filters.manifestHealth,
        clear: { manifestHealth: 'all' },
      });
    }
    if (filters.refreshSuccess === 'all') {
      list.push({
        key: 'refreshSuccess',
        label: 'All videos',
        clear: { refreshSuccess: 'last' },
      });
    }
    return list;
  }, [catalog, filters]);

  if (!chips.length) return null;

  return (
    <div className="chip-row" aria-label="Active filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="chip"
          onClick={() => onPatch(chip.clear ?? { search: '' })}
        >
          {chip.label}
          <span aria-hidden>×</span>
        </button>
      ))}
      <button type="button" className="chip chip-clear" onClick={onClear}>
        Clear all
      </button>
    </div>
  );
}

const SECTIONS = [
  { id: 'videos', label: 'Videos' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'history', label: 'History' },
  { id: 'archived', label: 'Archived' },
];

export function LibrarySectionTabs({ section, onChange }) {
  return (
    <nav className="section-tabs" aria-label="Library sections">
      {SECTIONS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`section-tab ${section === item.id ? 'section-tab-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
