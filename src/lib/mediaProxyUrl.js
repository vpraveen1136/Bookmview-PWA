export function isTwimgCdnUrl(url) {
  return /^https?:\/\/(video|pbs|ton)\.twimg\.com\//i.test(String(url || '').trim());
}

export function isSpankbangCdnUrl(url) {
  return /sb-cd\.com/i.test(String(url || ''));
}

export function isMobileMediaProxyUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  return value.includes('mobile-media');
}

export function needsMobileMediaProxy(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  if (isTwimgCdnUrl(value)) return true;
  if (isSpankbangCdnUrl(value)) return true;
  if (/[?&]secure=/i.test(value) && /\.mp4/i.test(value)) return true;
  return false;
}

/**
 * X/Twitter MP4 and m3u8 work with a direct CDN URL when no Referer is sent —
 * same as "Play media in Safari" (that link uses rel="noreferrer").
 * Sending the PWA origin as Referer yields HTTP 403.
 */
export function prefersDirectNoReferrerPlayback(url) {
  return isTwimgCdnUrl(url);
}

/** Fetch options for media probes / diagnostics (omit hotlink-blocking Referer on X). */
export function getMediaFetchOptions(url, extra = {}) {
  const options = { ...extra };
  if (prefersDirectNoReferrerPlayback(url)) {
    options.referrerPolicy = 'no-referrer';
  }
  return options;
}

function proxyPath() {
  const base = import.meta.env.BASE_URL || '/';
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return `${normalized}mobile-media`;
}

/**
 * Same-origin URL handled by the service worker (Referer / Range like desktop proxy).
 * @param {string} cdnUrl
 * @param {{ referer?: string }} [options]
 */
export function toMobileMediaProxyUrl(cdnUrl, options = {}) {
  const raw = String(cdnUrl || '').trim();
  if (!needsMobileMediaProxy(raw)) return raw;
  if (typeof window === 'undefined') return raw;

  const proxyUrl = new URL(proxyPath(), window.location.origin);
  proxyUrl.searchParams.set('u', raw);
  const referer = String(options.referer || '').trim();
  if (referer && !isTwimgCdnUrl(raw)) {
    proxyUrl.searchParams.set('ref', referer);
  }
  return proxyUrl.toString();
}

export function getPlaybackReferer(bookmark) {
  const slug = String(bookmark?.source_slug || 'x').trim() || 'x';
  const page = String(bookmark?.tweet_url || '').trim();
  if (slug === 'x') return 'https://x.com/';
  if (page && /^https?:\/\//i.test(page)) return page;
  if (/spankbang/i.test(page)) return page;
  return 'https://spankbang.com/';
}

export function wrapPlaybackUrlForDevice(cdnUrl, bookmark, mode) {
  const raw = String(cdnUrl || '').trim();
  if (!raw) return raw;

  if (prefersDirectNoReferrerPlayback(raw)) return raw;

  if (!needsMobileMediaProxy(raw)) return raw;
  return toMobileMediaProxyUrl(raw, { referer: getPlaybackReferer(bookmark) });
}

export function buildProxyPlaybackUrl(cdnUrl, bookmark) {
  const raw = String(cdnUrl || '').trim();
  if (!raw || !needsMobileMediaProxy(raw)) return raw;
  return toMobileMediaProxyUrl(raw, { referer: getPlaybackReferer(bookmark) });
}

export function buildPlaybackFallbackUrl(cdnUrl, bookmark, primaryUrl) {
  const raw = String(cdnUrl || '').trim();
  const primary = String(primaryUrl || '').trim();
  if (!raw) return null;

  // X/Twitter: direct CDN with no Referer (same as Play in Safari). SW proxy often
  // returns HTML on GH Pages when the worker is not controlling the page.
  if (prefersDirectNoReferrerPlayback(raw)) return null;

  const proxy = buildProxyPlaybackUrl(raw, bookmark);
  if (proxy && proxy !== primary) return proxy;

  if (primary !== raw) return raw;

  return null;
}
