/**
 * SpankBang official /embed/ playback — stable video id from page URLs (not expiring CDN URLs).
 */
import { unwrapProxiedMediaUrl } from './playback.js';

const SPANKBANG_ORIGIN = 'https://spankbang.com';

export function isSpankbangSource(bookmark) {
  return String(bookmark?.source_slug || 'x').trim().toLowerCase() === 'spankbang';
}

export function canUseSpankbangEmbedPlayback(bookmark) {
  return isSpankbangSource(bookmark);
}

function isSpankbangHost(hostname) {
  return /spankbang\.com$/i.test(String(hostname || '').replace(/^www\./i, ''));
}

/** Path segment before `/video` or `/embed` (e.g. `a50kv`). */
export function spankbangVideoIdFromPageUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, SPANKBANG_ORIGIN);
    if (!isSpankbangHost(parsed.hostname)) return null;
    const pathname = parsed.pathname;
    if (/\/playlist\//i.test(pathname)) return null;
    const embedMatch = pathname.match(/^\/([^/]+)\/embed\/?$/i);
    if (embedMatch) return embedMatch[1] || null;
    const videoMatch = pathname.match(/^\/([^/]+)\/video(?:\/|$)/i);
    return videoMatch?.[1] || null;
  } catch {
    return null;
  }
}

/** User-playlist item wrapper: /{user}-{entry}/playlist/{name} → entry id */
export function spankbangVideoSlugFromPlaylistWrapperUrl(url) {
  if (!url) return null;
  try {
    const pathname = new URL(url, SPANKBANG_ORIGIN).pathname;
    const match = pathname.match(/\/[^/]+-([a-z0-9]+)\/playlist\//i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function isPlaylistWrapperUrl(url) {
  return /\/[^/]+-[a-z0-9]+\/playlist\//i.test(String(url || ''));
}

/**
 * Resolve stable SpankBang video id from bookmark fields (never from CDN MP4/HLS).
 */
export function resolveSpankbangVideoId(bookmark) {
  if (!bookmark) return null;

  const candidates = [];
  const tweet = unwrapProxiedMediaUrl(String(bookmark.tweet_url || '').trim());
  if (tweet) candidates.push(tweet);

  const videoItem = bookmark?.media?.find(
    (item) => item.media_type === 'video' || item.media_type === 'animated_gif',
  );
  const mediaUrl = unwrapProxiedMediaUrl(videoItem?.url || '');
  if (mediaUrl) candidates.push(mediaUrl);

  for (const raw of candidates) {
    const fromPage = spankbangVideoIdFromPageUrl(raw);
    if (fromPage) return fromPage;
  }

  for (const raw of candidates) {
    const fromWrapper = spankbangVideoSlugFromPlaylistWrapperUrl(raw);
    if (fromWrapper) return fromWrapper;
  }

  return null;
}

export function spankbangEmbedUrlFromVideoId(videoId) {
  const id = String(videoId || '').trim();
  if (!id) return null;
  return `${SPANKBANG_ORIGIN}/${encodeURIComponent(id)}/embed/`;
}

export function resolveSpankbangEmbedUrl(bookmark) {
  const videoId = resolveSpankbangVideoId(bookmark);
  return spankbangEmbedUrlFromVideoId(videoId);
}

export function resolveSpankbangVideoPageUrl(bookmark) {
  const videoId = resolveSpankbangVideoId(bookmark);
  if (!videoId) return null;
  return `${SPANKBANG_ORIGIN}/${encodeURIComponent(videoId)}/video`;
}

/** Iframe-eligible: SpankBang source with a resolvable stable video id. */
export function isSpankbangIframeEligible(bookmark) {
  if (!canUseSpankbangEmbedPlayback(bookmark)) return false;
  return Boolean(resolveSpankbangVideoId(bookmark));
}
