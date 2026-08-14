import { matchesManifestHealthFilter } from './hlsUrlHealth.js';
import { getBookmarkDisplayTitle } from './playback.js';
import { isRefreshEligible } from './lastRefreshSuccess.js';

const MS_DAY = 86_400_000;

function parseDate(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function matchesDateAdded(bookmarkedAt, dateAdded) {
  if (!dateAdded || dateAdded === 'any') return true;
  const added = parseDate(bookmarkedAt);
  if (!added) return false;
  const now = Date.now();
  const windows = {
    last_7_days: 7 * MS_DAY,
    last_30_days: 30 * MS_DAY,
    last_year: 365 * MS_DAY,
  };
  const window = windows[dateAdded];
  if (!window) return true;
  return added >= now - window;
}

function matchesSearch(bookmark, query, catalog) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;

  const title = getBookmarkDisplayTitle(bookmark).toLowerCase();
  const text = String(bookmark.text || '').toLowerCase();
  const normalized = String(bookmark.normalizedTitle || '').toLowerCase();
  const url = String(bookmark.tweet_url || '').toLowerCase();

  if (title.includes(q) || text.includes(q) || normalized.includes(q) || url.includes(q)) {
    return true;
  }

  const author = catalog.authors.find((a) => a.user_id === bookmark.author_user_id);
  if (author) {
    const display = String(author.display_name || '').toLowerCase();
    const username = String(author.username || '').toLowerCase();
    if (display.includes(q) || username.includes(q)) return true;
  }

  for (const tagId of bookmark.tagIds ?? []) {
    const tag = catalog.tags.find((t) => t.id === tagId);
    if (tag && String(tag.name).toLowerCase().includes(q)) return true;
  }

  return false;
}

function hasCaseInsensitive(list, value) {
  const needle = String(value || '').trim().toLowerCase();
  if (!needle) return true;
  return (list ?? []).some((item) => String(item).toLowerCase() === needle);
}

export const DEFAULT_LIBRARY_FILTERS = {
  section: 'videos',
  search: '',
  sources: [],
  author: '',
  read: undefined,
  dateAdded: 'any',
  tagIds: [],
  playlistId: '',
  sort: 'newest',
  movieGenre: '',
  movieMood: '',
  movieCast: '',
  movieRegion: '',
  movieStudio: '',
  movieDecade: '',
  manifestHealth: 'all',
  refreshSuccess: 'last',
};

export function countActiveFilters(filters) {
  let count = 0;
  if (filters.search?.trim()) count += 1;
  count += (filters.sources ?? []).length;
  if (filters.author) count += 1;
  if (filters.read === true || filters.read === false) count += 1;
  if (filters.dateAdded && filters.dateAdded !== 'any') count += 1;
  count += (filters.tagIds ?? []).length;
  if (filters.playlistId) count += 1;
  if (filters.movieGenre) count += 1;
  if (filters.movieMood) count += 1;
  if (filters.movieCast) count += 1;
  if (filters.movieRegion) count += 1;
  if (filters.movieStudio) count += 1;
  if (filters.movieDecade) count += 1;
  if (filters.manifestHealth && filters.manifestHealth !== 'all') count += 1;
  // 'last' is the default view — only count when user explicitly chose All (no chip needed for default).
  return count;
}

export function applyLibraryFilters(items, filters, catalog, healthMap = {}) {
  const section = filters.section || 'videos';
  const libraryScope = Array.isArray(items) ? items : [];

  return items.filter((bookmark) => {
    if (section === 'favorites' && !bookmark.is_favorite) return false;
    if (section === 'archived') {
      if (!bookmark.is_archived) return false;
    } else if (section !== 'archived' && bookmark.is_archived) {
      return false;
    }

    if (section === 'history') {
      if (!bookmark.last_viewed_at) return false;
    }

    if (filters.refreshSuccess === 'last' && !isRefreshEligible(bookmark, libraryScope)) {
      return false;
    }

    if ((filters.sources ?? []).length) {
      const allowed = new Set(
        (filters.sources ?? []).map((slug) => String(slug || '').trim().toLowerCase()).filter(Boolean),
      );
      const slug = String(bookmark.source_slug || 'x').trim().toLowerCase() || 'x';
      if (!allowed.has(slug)) return false;
    }
    if (filters.author && bookmark.author_user_id !== filters.author) return false;
    if (filters.read === true && !bookmark.is_read) return false;
    if (filters.read === false && bookmark.is_read) return false;
    if (!matchesDateAdded(bookmark.bookmarked_at, filters.dateAdded)) return false;

    for (const tagId of filters.tagIds ?? []) {
      if (!(bookmark.tagIds ?? []).includes(tagId)) return false;
    }

    if (filters.playlistId) {
      const pid = Number(filters.playlistId);
      if (!bookmark.playlistIds?.includes(pid)) return false;
    }

    if (filters.movieGenre && !hasCaseInsensitive(bookmark.genres, filters.movieGenre)) return false;
    if (filters.movieMood && !hasCaseInsensitive(bookmark.moods, filters.movieMood)) return false;
    if (filters.movieCast && !hasCaseInsensitive(bookmark.casts, filters.movieCast)) return false;
    if (filters.movieRegion && String(bookmark.cinemaIndustry || '').toLowerCase() !== filters.movieRegion.toLowerCase()) {
      return false;
    }
    if (filters.movieStudio && String(bookmark.studio || '').toLowerCase() !== filters.movieStudio.toLowerCase()) {
      return false;
    }
    if (filters.movieDecade && String(bookmark.decade || '').toLowerCase() !== filters.movieDecade.toLowerCase()) {
      return false;
    }

    if (!matchesManifestHealthFilter(bookmark, filters.manifestHealth, healthMap)) return false;

    return matchesSearch(bookmark, filters.search, catalog);
  });
}

export function getDurationMs(bookmark) {
  const video = bookmark.media?.find(
    (m) => m.media_type === 'video' || m.media_type === 'animated_gif',
  );
  if (video?.duration_ms > 0) return video.duration_ms;
  if (bookmark.runtimeMinutes > 0) return bookmark.runtimeMinutes * 60_000;
  return null;
}

export function sortLibraryItems(items, sort, section) {
  const effectiveSort = section === 'history' ? 'last_viewed' : (sort || 'newest');
  const list = [...items];

  list.sort((a, b) => {
    switch (effectiveSort) {
      case 'oldest': {
        const aDate = parseDate(a.bookmarked_at) ?? parseDate(a.posted_at) ?? 0;
        const bDate = parseDate(b.bookmarked_at) ?? parseDate(b.posted_at) ?? 0;
        return aDate - bDate || String(a.tweet_id).localeCompare(String(b.tweet_id));
      }
      case 'last_viewed': {
        const aDate = parseDate(a.last_viewed_at) ?? 0;
        const bDate = parseDate(b.last_viewed_at) ?? 0;
        return bDate - aDate || String(b.tweet_id).localeCompare(String(a.tweet_id));
      }
      case 'duration': {
        const aDur = getDurationMs(a);
        const bDur = getDurationMs(b);
        if (aDur == null && bDur == null) return 0;
        if (aDur == null) return 1;
        if (bDur == null) return -1;
        return bDur - aDur;
      }
      case 'duration_asc': {
        const aDur = getDurationMs(a);
        const bDur = getDurationMs(b);
        if (aDur == null && bDur == null) return 0;
        if (aDur == null) return 1;
        if (bDur == null) return -1;
        return aDur - bDur;
      }
      case 'rating_desc': {
        const aR = Number(a.personalRating) || 0;
        const bR = Number(b.personalRating) || 0;
        if (!aR && !bR) return 0;
        if (!aR) return 1;
        if (!bR) return -1;
        return bR - aR;
      }
      case 'rating_asc': {
        const aR = Number(a.personalRating) || 0;
        const bR = Number(b.personalRating) || 0;
        if (!aR && !bR) return 0;
        if (!aR) return 1;
        if (!bR) return -1;
        return aR - bR;
      }
      case 'newest':
      default: {
        const aDate = parseDate(a.bookmarked_at) ?? parseDate(a.posted_at) ?? 0;
        const bDate = parseDate(b.bookmarked_at) ?? parseDate(b.posted_at) ?? 0;
        return bDate - aDate || String(b.tweet_id).localeCompare(String(a.tweet_id));
      }
    }
  });

  return list;
}

export function formatDuration(ms) {
  if (!ms || ms < 1000) return '';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
