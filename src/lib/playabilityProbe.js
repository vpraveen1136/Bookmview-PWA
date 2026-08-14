import { checkPlayableHlsManifest } from './hlsUrlHealth.js';
import { ensureProxyForPlaybackUrl } from './mediaProxyReady.js';
import { getMediaFetchOptions } from './mediaProxyUrl.js';
import { resolveMp4ProbePlayback } from './playbackModes.js';
import { resolveHlsPlayback } from './playback.js';

/**
 * Lightweight playability probe for one bookmark.
 * Tries progressive MP4 first; if that fails, tries HLS (m3u8).
 *
 * @returns {Promise<'playable' | 'non_playable' | 'network_error'>}
 */
export async function probeBookmarkPlayability(bookmark, signal) {
  if (!bookmark) return 'non_playable';

  const mp4Playback = resolveMp4ProbePlayback(bookmark);
  if (mp4Playback?.url) {
    const mp4Result = await probeMp4Playback(mp4Playback.url, signal);
    if (mp4Result === 'playable') return 'playable';
    if (mp4Result === 'network_error') return 'network_error';
  }

  const hls = resolveHlsPlayback(bookmark);
  if (hls?.url) {
    try {
      const result = await checkPlayableHlsManifest(hls.url, signal);
      return result === 'active' ? 'playable' : 'non_playable';
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      if (isLikelyNetworkFailure(error)) return 'network_error';
      return 'non_playable';
    }
  }

  return 'non_playable';
}

async function probeMp4Playback(url, signal) {
  try {
    const proxyReady = await ensureProxyForPlaybackUrl(url);
    if (!proxyReady) return 'network_error';
    const ok = await probeMp4Url(url, signal);
    return ok ? 'playable' : 'non_playable';
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (isLikelyNetworkFailure(error)) return 'network_error';
    return 'non_playable';
  }
}

async function probeMp4Url(url, signal) {
  const response = await fetch(url, getMediaFetchOptions(url, {
    method: 'GET',
    headers: { Range: 'bytes=0-2047' },
    cache: 'no-store',
    signal,
  }));
  if (response.status === 403) return false;
  if (response.status >= 400 && response.status !== 206) return false;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('text/plain')) return false;
  const reader = response.body?.getReader?.();
  if (reader) {
    try {
      const { value } = await reader.read();
      await reader.cancel();
      const snippet = new TextDecoder().decode(value || new Uint8Array()).slice(0, 256);
      if (/expired|access denied|forbidden/i.test(snippet)) return false;
    } catch {
      // ignore body read issues if headers looked fine
    }
  }
  return true;
}

export function isLikelyNetworkFailure(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const name = String(error?.name || '');
  const message = String(error?.message || error || '').toLowerCase();
  if (name === 'TypeError') return true;
  return /failed to fetch|networkerror|load failed|offline|internet/i.test(message);
}

export function bookmarkHasProbeableMedia(bookmark) {
  return Boolean(resolveMp4ProbePlayback(bookmark)?.url || resolveHlsPlayback(bookmark)?.url);
}
