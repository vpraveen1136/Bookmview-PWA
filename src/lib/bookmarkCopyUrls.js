import {
  isAllowedVideoUrl,
  isHeadlessSource,
  isSensitiveMediaUrl,
  resolveHlsPlayback,
  resolvePlayMediaMp4Url,
  unwrapProxiedMediaUrl,
} from './playback.js';

function isPlaylistWrapperUrl(url) {
  return /\/[^/]+-[a-z0-9]+\/playlist\//i.test(String(url || ''));
}

function isRealVideoPageUrl(url) {
  const value = String(url || '').trim();
  if (!value || isPlaylistWrapperUrl(value)) return false;
  return /\/video(?:\/|$)/i.test(value);
}

/**
 * Source page URL: X → tweet_url; headless (SPBG) → real video page when known.
 */
export function getBookmarkSourceUrl(bookmark) {
  if (!bookmark) return null;

  const tweet = String(bookmark?.tweet_url || '').trim();
  if (!isHeadlessSource(bookmark)) {
    return tweet ? unwrapProxiedMediaUrl(tweet) : null;
  }

  if (tweet && isRealVideoPageUrl(tweet)) {
    return unwrapProxiedMediaUrl(tweet);
  }

  const videoItem = bookmark?.media?.find(
    (item) => item.media_type === 'video' || item.media_type === 'animated_gif',
  );
  const mediaUrl = unwrapProxiedMediaUrl(videoItem?.url || '');
  if (mediaUrl && isRealVideoPageUrl(mediaUrl)) return mediaUrl;
  if (mediaUrl && !isAllowedVideoUrl(mediaUrl) && !isSensitiveMediaUrl(mediaUrl)) return mediaUrl;

  return tweet ? unwrapProxiedMediaUrl(tweet) : null;
}

export function getBookmarkMp4Url(bookmark) {
  return resolvePlayMediaMp4Url(bookmark) || null;
}

export function getBookmarkHlsUrl(bookmark) {
  return resolveHlsPlayback(bookmark)?.url || null;
}
