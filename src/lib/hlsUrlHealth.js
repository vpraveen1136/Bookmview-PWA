import { isAllowedVideoUrl, normalizeVideoVariantsFromBookmark, unwrapProxiedMediaUrl } from './playback.js';
import { getMediaFetchOptions } from './mediaProxyUrl.js';

const M3U8_RE = /\.m3u8(?:[?#]|$)/i;

export function getBookmarkHlsManifestUrl(bookmark) {
  const hls = String(bookmark?.hls_manifest_url || '').trim();
  if (!M3U8_RE.test(hls)) return null;
  return unwrapProxiedMediaUrl(hls);
}

/** Stable key for persisted health (tweet + manifest URL). */
export function bookmarkHealthKey(bookmark) {
  const url = getBookmarkHlsManifestUrl(bookmark);
  if (!url) return null;
  return `${bookmark.tweet_id}::${url}`;
}

function resolvePlaylistUrl(baseUrl, relative) {
  try {
    return new URL(relative, baseUrl).toString();
  } catch {
    return null;
  }
}

function isValidM3u8Body(snippet, contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (snippet.includes('#EXTM3U')) return true;
  return ct.includes('mpegurl') || ct.includes('application/x-mpegurl');
}

function parseLines(manifestText) {
  return String(manifestText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** First media or variant URL to probe (master → child playlist URL). */
export function pickProbeUrlFromManifest(manifestText, manifestUrl) {
  const lines = parseLines(manifestText);
  const isMaster = lines.some((line) => line.includes('#EXT-X-STREAM-INF'));

  if (isMaster) {
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes('#EXT-X-STREAM-INF')) continue;
      const next = lines[i + 1];
      if (next && !next.startsWith('#')) {
        return resolvePlaylistUrl(manifestUrl, next);
      }
    }
    return null;
  }

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    return resolvePlaylistUrl(manifestUrl, line);
  }
  return null;
}

async function fetchManifestText(url, signal) {
  const response = await fetch(url, getMediaFetchOptions(url, {
    method: 'GET',
    cache: 'no-store',
    signal,
  }));
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  return { response, contentType, text };
}

async function probeBytesUrl(url, signal) {
  try {
    const response = await fetch(url, getMediaFetchOptions(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-2047' },
      cache: 'no-store',
      signal,
    }));
    if (response.status >= 400 && response.status !== 206) return false;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) return false;
    const snippet = (await response.text()).slice(0, 512);
    if (/expired|access denied|forbidden/i.test(snippet)) return false;
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return false;
  }
}

/**
 * Playable check: valid m3u8 body + first segment (or child playlist + segment) responds.
 * @returns {Promise<'active' | 'stale'>}
 */
export async function checkPlayableHlsManifest(manifestUrl, signal) {
  const url = String(manifestUrl || '').trim();
  if (!url) return 'stale';

  try {
    const { response, contentType, text } = await fetchManifestText(url, signal);
    if (response.status >= 400) return 'stale';

    const snippet = text.slice(0, 8192);
    if (contentType.toLowerCase().includes('text/html') || /expired|access denied|forbidden/i.test(snippet)) {
      return 'stale';
    }
    if (!isValidM3u8Body(snippet, contentType)) return 'stale';

    let probeTarget = pickProbeUrlFromManifest(snippet, url);
    if (!probeTarget) return 'stale';

    if (M3U8_RE.test(probeTarget)) {
      const child = await fetchManifestText(probeTarget, signal);
      if (child.response.status >= 400) return 'stale';
      const childSnippet = child.text.slice(0, 8192);
      if (!isValidM3u8Body(childSnippet, child.contentType)) return 'stale';
      probeTarget = pickProbeUrlFromManifest(childSnippet, probeTarget);
      if (!probeTarget) return 'stale';
    }

    const segmentOk = await probeBytesUrl(probeTarget, signal);
    return segmentOk ? 'active' : 'stale';
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return 'stale';
  }
}

/** @deprecated alias */
export const checkHlsManifestUrl = checkPlayableHlsManifest;

/** Progressive MP4 only (no saved m3u8) — treated as stale until in-app MP4 playback is fixed. */
export function bookmarkHasOnlyMp4Playback(bookmark) {
  if (getBookmarkHlsManifestUrl(bookmark)) return false;
  const variants = normalizeVideoVariantsFromBookmark(bookmark).filter((v) => isAllowedVideoUrl(v.url));
  return variants.length > 0;
}

export function countMp4OnlyBookmarks(library) {
  return (library ?? []).filter((bookmark) => bookmarkHasOnlyMp4Playback(bookmark)).length;
}

export function listBookmarksWithHlsManifest(library) {
  return (library ?? []).filter((bookmark) => Boolean(getBookmarkHlsManifestUrl(bookmark)));
}

export function getManifestHealthStatus(bookmark, healthMap) {
  const key = bookmarkHealthKey(bookmark);
  if (!key) {
    if (bookmarkHasOnlyMp4Playback(bookmark)) return 'stale';
    return 'none';
  }
  return healthMap[key] || 'unchecked';
}

export function matchesManifestHealthFilter(bookmark, filter, healthMap) {
  const mode = filter || 'all';
  if (mode === 'all') return true;

  const status = getManifestHealthStatus(bookmark, healthMap);
  if (mode === 'active') return status === 'active';
  if (mode === 'stale') return status === 'stale';
  if (mode === 'unchecked') return status === 'unchecked';
  return true;
}

export function stalePlaceholderLabel(bookmark) {
  if (bookmarkHealthKey(bookmark)) return 'Not playable';
  if (bookmarkHasOnlyMp4Playback(bookmark)) return 'MP4 only';
  return 'No image';
}

export function summarizePlayableCheck(healthMap, manifestCount) {
  const passed = Object.values(healthMap).filter((s) => s === 'active').length;
  const failed = Object.values(healthMap).filter((s) => s === 'stale').length;
  const checked = manifestCount > 0 ? manifestCount : passed + failed;
  return { checked, passed, failed };
}

const CONCURRENCY = 3;

export async function runPlayableCheckForLibrary(bookmarks, options = {}) {
  const list = listBookmarksWithHlsManifest(bookmarks);
  const total = list.length;
  const healthMap = {};
  let done = 0;
  const signal = options.signal;

  const report = (label) => {
    options.onProgress?.({ done, total, label });
  };

  report('Starting…');

  let index = 0;
  async function worker() {
    while (index < list.length) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const bookmark = list[index];
      index += 1;
      const key = bookmarkHealthKey(bookmark);
      const url = getBookmarkHlsManifestUrl(bookmark);
      const label = String(bookmark.tweet_id || '').slice(0, 12);
      report(label);
      if (key && url) {
        healthMap[key] = await checkPlayableHlsManifest(url, signal);
      }
      done += 1;
      report(label);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, list.length || 1) }, () => worker());
  await Promise.all(workers);

  return healthMap;
}

/** @deprecated alias */
export const checkHlsManifestsForLibrary = runPlayableCheckForLibrary;
