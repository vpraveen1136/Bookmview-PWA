import { getDurationMs } from './libraryFilters.js';
import { isPlayableOnDevice, preferMp4Variants } from './devicePlayback.js';
import {
  filterStreamQualityVariants,
  formatStreamVariantLabel,
} from './streamPlayback.js';
import {
  getBookmarkThumbnailUrl,
  isAllowedVideoUrl,
  normalizeVideoVariantsFromBookmark,
  resolveHlsPlayback,
  unwrapProxiedMediaUrl,
} from './playback.js';
import { buildPlaybackFallbackUrl, isMobileMediaProxyUrl, wrapPlaybackUrlForDevice } from './mediaProxyUrl.js';

export const PLAYBACK_MODES = {
  STREAM: 'stream',
  DIRECT: 'direct',
  BUFFER: 'buffer',
  HLS: 'hls',
};

const MODE_LABELS = {
  [PLAYBACK_MODES.STREAM]: 'Stream chunks',
  [PLAYBACK_MODES.DIRECT]: 'Direct CDN',
  [PLAYBACK_MODES.BUFFER]: 'Full file',
  [PLAYBACK_MODES.HLS]: 'HLS (m3u8)',
};

const STORAGE_KEY = 'bookmview.pwa.playbackMode';
const LEGACY_SESSION_KEY = 'bookmview.pwa.playbackMode';

export const PLAYBACK_MODE_OPTIONS = [
  { id: PLAYBACK_MODES.STREAM, label: MODE_LABELS[PLAYBACK_MODES.STREAM] },
  { id: PLAYBACK_MODES.DIRECT, label: MODE_LABELS[PLAYBACK_MODES.DIRECT] },
  { id: PLAYBACK_MODES.BUFFER, label: MODE_LABELS[PLAYBACK_MODES.BUFFER] },
  { id: PLAYBACK_MODES.HLS, label: MODE_LABELS[PLAYBACK_MODES.HLS] },
];

export function getStoredPlaybackMode() {
  try {
    const value = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (value && Object.values(PLAYBACK_MODES).includes(value)) return value;
  } catch {
    // ignore
  }
  return PLAYBACK_MODES.STREAM;
}

export function getDefaultPlaybackModeForBookmark(bookmark) {
  const available = listAvailablePlaybackModes(bookmark).map((item) => item.id);
  if (getProgressiveVariants(bookmark).length && available.includes(PLAYBACK_MODES.STREAM)) {
    return PLAYBACK_MODES.STREAM;
  }
  const preferred = getStoredPlaybackMode();
  if (available.includes(preferred)) return preferred;
  if (resolveHlsPlayback(bookmark) && available.includes(PLAYBACK_MODES.HLS)) {
    return PLAYBACK_MODES.HLS;
  }
  return available[0] || PLAYBACK_MODES.STREAM;
}

/**
 * Mode used for watch + probes. X/Twitter HLS is unreliable in the static PWA;
 * progressive MP4 with no Referer matches “Play in Safari”.
 */
export function getEffectivePlaybackMode(bookmark, availableModeIds = null) {
  const available = availableModeIds || listAvailablePlaybackModes(bookmark).map((item) => item.id);
  if (!available.length) return getStoredPlaybackMode();

  const slug = String(bookmark?.source_slug || '').trim().toLowerCase();
  if (slug === 'x' && available.includes(PLAYBACK_MODES.STREAM)) {
    const stored = getStoredPlaybackMode();
    if (stored === PLAYBACK_MODES.HLS) return PLAYBACK_MODES.STREAM;
  }

  const preferred = getStoredPlaybackMode();
  if (available.includes(preferred)) return preferred;
  return getDefaultPlaybackModeForBookmark(bookmark);
}

export function resolveProbePlayback(bookmark) {
  if (!bookmark) return null;
  const mode = getEffectivePlaybackMode(bookmark);
  return resolvePlaybackForMode(bookmark, mode, '');
}

/** MP4-first probe URL (stream mode, lowest variant) — used before HLS fallback in PWA. */
export function resolveMp4ProbePlayback(bookmark) {
  if (!bookmark) return null;
  return resolvePlaybackForMode(bookmark, PLAYBACK_MODES.STREAM, '');
}

export function resolvePlaybackAlternates(bookmark, primaryMode) {
  const modes = listAvailablePlaybackModes(bookmark);
  const order = [
    PLAYBACK_MODES.STREAM,
    PLAYBACK_MODES.DIRECT,
    PLAYBACK_MODES.BUFFER,
    PLAYBACK_MODES.HLS,
  ];
  const alternates = [];
  for (const id of order) {
    if (id === primaryMode) continue;
    if (!modes.some((item) => item.id === id)) continue;
    const resolved = resolvePlaybackForMode(bookmark, id, '');
    if (resolved?.url) alternates.push(resolved);
  }
  return alternates;
}

export function setStoredPlaybackMode(mode) {
  if (!Object.values(PLAYBACK_MODES).includes(mode)) return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    sessionStorage.setItem(LEGACY_SESSION_KEY, mode);
  } catch {
    // ignore
  }
}

export function getProgressiveVariants(bookmark) {
  const variants = normalizeVideoVariantsFromBookmark(bookmark)
    .filter((v) => isPlayableOnDevice(v.url));
  return preferMp4Variants(variants);
}

export function listAvailablePlaybackModes(bookmark) {
  const modes = [];
  const progressive = getProgressiveVariants(bookmark);
  if (progressive.length) {
    modes.push(PLAYBACK_MODES.STREAM, PLAYBACK_MODES.DIRECT, PLAYBACK_MODES.BUFFER);
  }
  if (resolveHlsPlayback(bookmark)) {
    modes.push(PLAYBACK_MODES.HLS);
  }
  return modes.map((id) => ({ id, label: MODE_LABELS[id] }));
}

export function getVariantsForMode(bookmark, mode) {
  const all = getProgressiveVariants(bookmark);
  if (!all.length) return [];

  if (mode === PLAYBACK_MODES.STREAM || mode === PLAYBACK_MODES.DIRECT) {
    const filtered = filterStreamQualityVariants(all);
    return filtered.length ? filtered : all;
  }

  return all;
}

export function pickDefaultVariantUrl(bookmark, mode, durationMs) {
  const pool = getVariantsForMode(bookmark, mode);
  if (!pool.length) return '';
  // Lowest quality — faster playability probes and quicker first frame.
  return pool[pool.length - 1].url;
}

/**
 * @returns {{ type: 'hls' | 'mp4', url: string, poster?: string | null, mode: string } | null}
 */
export function resolvePlaybackForMode(bookmark, mode, selectedVariantUrl = '') {
  if (!bookmark) return null;

  const durationMs = getDurationMs(bookmark);
  const poster = getBookmarkThumbnailUrl(bookmark);

  if (mode === PLAYBACK_MODES.HLS) {
    const hls = resolveHlsPlayback(bookmark);
    if (!hls) return null;
    const cdnUrl = unwrapProxiedMediaUrl(hls.url);
    const playbackUrl = wrapPlaybackUrlForDevice(cdnUrl, bookmark, mode);
    return {
      ...hls,
      url: playbackUrl,
      cdnUrl,
      proxyUrl: buildPlaybackFallbackUrl(cdnUrl, bookmark, playbackUrl),
      mode,
    };
  }

  const variants = getVariantsForMode(bookmark, mode);
  if (!variants.length) return null;

  let url = String(selectedVariantUrl || '').trim();
  if (url) {
    url = unwrapProxiedMediaUrl(url);
    if (!isPlayableOnDevice(url)) url = '';
  }
  if (!url) {
    url = pickDefaultVariantUrl(bookmark, mode, durationMs);
  }

  if (!url) {
    const fallback = normalizeVideoVariantsFromBookmark(bookmark)
      .map((v) => unwrapProxiedMediaUrl(v.url))
      .find((candidate) => isPlayableOnDevice(candidate));
    url = fallback || '';
  }

  if (!url || !isPlayableOnDevice(url)) return null;

  const cdnUrl = unwrapProxiedMediaUrl(url);
  const playbackUrl = wrapPlaybackUrlForDevice(cdnUrl, bookmark, mode);

  return {
    type: 'mp4',
    url: playbackUrl,
    cdnUrl,
    proxyUrl: buildPlaybackFallbackUrl(cdnUrl, bookmark, playbackUrl),
    poster,
    mode,
  };
}

export function formatVariantOptionLabel(variant, bookmark, mode) {
  return formatStreamVariantLabel(variant, getDurationMs(bookmark));
}

export function isLocalProxyUrl(url) {
  const raw = String(url || '');
  if (isMobileMediaProxyUrl(raw)) return false;
  const value = unwrapProxiedMediaUrl(raw);
  return /\/api\/media\/proxy/i.test(value)
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value);
}
