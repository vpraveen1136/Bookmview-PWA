import { ensureMediaProxyReady } from './mediaProxyReady.js';
import { isMobileMediaProxyUrl } from './mediaProxyUrl.js';
import { getDurationMs } from './libraryFilters.js';
import { unwrapProxiedMediaUrl, resolveHlsPlayback } from './playback.js';
import { getProgressiveVariants, PLAYBACK_MODES } from './playbackModes.js';
import { wrapPlaybackUrlForDevice } from './mediaProxyUrl.js';

export const PREVIEW_CLIP_SECONDS = 10;
export const SCROLL_PREVIEW_PROXY_TIMEOUT_MS = 2500;
export const SCROLL_PREVIEW_PREFETCH_TIMEOUT_MS = 12000;
export const SCROLL_PREVIEW_PREFETCH_MIN_BUFFER_SEC = 4;

export async function ensureProxyForPreviewUrl(url) {
  if (!isMobileMediaProxyUrl(url)) return true;
  return ensureMediaProxyReady(SCROLL_PREVIEW_PROXY_TIMEOUT_MS);
}

export function pickClipWindow(durationSec) {
  const start = pickRandomClipStart(durationSec);
  const end = Number.isFinite(durationSec) && durationSec > 0
    ? Math.min(start + PREVIEW_CLIP_SECONDS, durationSec)
    : start + PREVIEW_CLIP_SECONDS;
  return { clipStart: start, segmentEnd: end };
}

/**
 * Smallest progressive MP4, else HLS — mirrors desktop hover preview selection.
 * @returns {{ type: 'mp4' | 'hls', url: string, cdnUrl?: string } | null}
 */
export function getBookmarkScrollPreviewSource(bookmark) {
  const progressive = getProgressiveVariants(bookmark);
  if (progressive.length) {
    const smallest = progressive[progressive.length - 1];
    const cdnUrl = unwrapProxiedMediaUrl(smallest.url);
    const url = wrapPlaybackUrlForDevice(cdnUrl, bookmark, PLAYBACK_MODES.STREAM);
    return { type: 'mp4', url, cdnUrl };
  }

  const hls = resolveHlsPlayback(bookmark);
  if (hls?.url) {
    const cdnUrl = unwrapProxiedMediaUrl(hls.url);
    const url = wrapPlaybackUrlForDevice(cdnUrl, bookmark, PLAYBACK_MODES.HLS);
    return { type: 'hls', url, cdnUrl };
  }

  return null;
}

export function durationSecondsForPreview(bookmark, video) {
  const fromBookmark = Number(getDurationMs(bookmark));
  if (Number.isFinite(fromBookmark) && fromBookmark > 0) {
    return fromBookmark / 1000;
  }
  const fromVideo = Number(video?.duration);
  if (Number.isFinite(fromVideo) && fromVideo > 0) return fromVideo;
  return null;
}

export function pickRandomClipStart(durationSec) {
  if (!Number.isFinite(durationSec) || durationSec <= PREVIEW_CLIP_SECONDS + 1) {
    return 0;
  }
  return Math.random() * (durationSec - PREVIEW_CLIP_SECONDS);
}
