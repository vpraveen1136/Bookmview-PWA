import {
  getHeadlessBookmarkTitle,
  isHeadlessSourceBookmark,
  isSpankbangInternalUploaderId,
} from './spankbangTitle.js';

const ALLOWED_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'm4v', 'mov']);

/** URLs we never show in the UI (expiring manifests / segments). */
export function isStreamManifestUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return /\.m3u8(?:[?#]|$)|\.m4s(?:[?#]|$)|\.mpd(?:[?#]|$)/i.test(lower)
    || /\/manifest(?:[/?#]|$)/i.test(lower);
}

export function isSensitiveMediaUrl(url) {
  return isStreamManifestUrl(url) || /\.ts(?:[?#]|$)/i.test(String(url || '').toLowerCase());
}

export function unwrapProxiedMediaUrl(url) {
  let current = url;
  for (let step = 0; step < 5; step += 1) {
    if (!current || typeof current !== 'string') return current;

    if (current.includes('mobile-media')) {
      try {
        const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
        const parsed = new URL(current, base);
        const upstream = parsed.searchParams.get('u');
        if (upstream && upstream !== current) {
          current = upstream;
          continue;
        }
      } catch {
        break;
      }
      break;
    }

    if (!current.includes('/api/media/proxy')) break;
    const queryStart = current.indexOf('?');
    if (queryStart === -1) break;
    const upstreamUrl = new URLSearchParams(current.slice(queryStart + 1)).get('url');
    if (!upstreamUrl || upstreamUrl === current) break;
    current = upstreamUrl;
  }
  return current;
}

export function getVideoExtensionFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\.([a-z0-9]+)$/i);
    if (pathMatch) return pathMatch[1].toLowerCase();
  } catch {
    const match = String(url).match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    if (match) return match[1].toLowerCase();
  }
  return '';
}

export function isAllowedVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  const lower = url.toLowerCase();
  if (/\.m4s(?:[?#]|$)|\.mpd(?:[?#]|$)|\.m3u8(?:[?#]|$)/i.test(lower)) return false;
  if (/\.ts(?:[?#]|$)/i.test(lower) && !lower.includes('.ts.')) return false;
  if (/\/vid\/avc1\/\d+\/\d+\//i.test(lower)) return false;
  const ext = getVideoExtensionFromUrl(url);
  return Boolean(ext && ALLOWED_VIDEO_EXTENSIONS.has(ext));
}

export function normalizeVideoVariantsFromBookmark(bookmark) {
  const videoItem = bookmark?.media?.find(
    (item) => item.media_type === 'video' || item.media_type === 'animated_gif',
  );
  if (!videoItem) return [];

  let extraVariants = [];
  if (videoItem.variants_json) {
    try {
      extraVariants = typeof videoItem.variants_json === 'string'
        ? JSON.parse(videoItem.variants_json)
        : videoItem.variants_json;
    } catch {
      extraVariants = [];
    }
  }

  const rawUrl = videoItem.url || videoItem.media_url;
  return normalizeVideoVariants([
    ...(Array.isArray(extraVariants) ? extraVariants : []),
    rawUrl ? { url: rawUrl, width: videoItem.width, height: videoItem.height } : null,
  ].filter(Boolean)).map((variant) => ({
    ...variant,
    url: unwrapProxiedMediaUrl(variant.url),
  }));
}

function parseDimensionsFromUrl(url) {
  const match = String(url || '').match(/\/(\d{2,4})x(\d{2,4})\//i);
  if (!match) return { width: null, height: null };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function variantScore(variant) {
  const height = Number(variant?.height) || 0;
  const width = Number(variant?.width) || 0;
  const bitrate = Number(variant?.bitrate) || 0;
  let score = height * 1000 + width;
  if (!height) {
    const fromUrl = parseDimensionsFromUrl(variant?.url).height;
    if (fromUrl) score += fromUrl * 1000;
  }
  score += bitrate / 1000;
  return score;
}

function normalizeVideoVariants(candidates = []) {
  const byUrl = new Map();
  for (const candidate of candidates) {
    if (!candidate?.url) continue;
    const dims = parseDimensionsFromUrl(candidate.url);
    const normalized = {
      url: unwrapProxiedMediaUrl(candidate.url),
      width: Number(candidate.width) > 0 ? Number(candidate.width) : dims.width,
      height: Number(candidate.height) > 0 ? Number(candidate.height) : dims.height,
      bitrate: Number(candidate.bitrate) > 0 ? Number(candidate.bitrate) : null,
    };
    const existing = byUrl.get(normalized.url);
    if (!existing || variantScore(normalized) > variantScore(existing)) {
      byUrl.set(normalized.url, normalized);
    }
  }
  return Array.from(byUrl.values()).sort((a, b) => variantScore(b) - variantScore(a));
}

export function getBookmarkDisplayTitle(bookmark) {
  const local = String(bookmark?.local_title || '').trim();
  if (local && !isSensitiveMediaUrl(local)) return local;

  const normalized = String(bookmark?.normalizedTitle || '').trim();
  if (normalized) return normalized;

  if (isHeadlessSourceBookmark(bookmark)) {
    const fromHeadless = getHeadlessBookmarkTitle(bookmark);
    if (fromHeadless && !isSensitiveMediaUrl(fromHeadless)) return fromHeadless;
  }

  const text = String(bookmark?.text || '').trim();
  if (text && !isSensitiveMediaUrl(text)) {
    if (!isHeadlessSourceBookmark(bookmark) || !isSpankbangInternalUploaderId(text)) {
      return text.length > 120 ? `${text.slice(0, 117)}…` : text;
    }
  }

  const pageUrl = getBookmarkPageUrl(bookmark);
  if (pageUrl) {
    try {
      const host = new URL(pageUrl).hostname.replace(/^www\./, '');
      return host || 'Video';
    } catch {
      return 'Video';
    }
  }
  return 'Video';
}

/** Stable page URL for display / opening in browser — never an m3u8 or CDN segment URL. */
export function getBookmarkPageUrl(bookmark) {
  const candidates = [
    bookmark?.tweet_url,
    bookmark?.media?.find((m) => m.media_type === 'video')?.url,
  ];
  for (const raw of candidates) {
    const url = String(raw || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (isSensitiveMediaUrl(url)) continue;
    if (isAllowedVideoUrl(unwrapProxiedMediaUrl(url))) continue;
    return unwrapProxiedMediaUrl(url);
  }
  return null;
}

/** Best progressive MP4 for “Play Media” (never m3u8) — highest quality variant. */
export function resolvePlayMediaMp4Url(bookmark) {
  const variants = normalizeVideoVariantsFromBookmark(bookmark).filter((v) => isAllowedVideoUrl(v.url));
  if (!variants.length) return null;
  return variants[0].url;
}

function resolveMp4Playback(bookmark) {
  const variants = normalizeVideoVariantsFromBookmark(bookmark).filter((v) => isAllowedVideoUrl(v.url));
  if (!variants.length) return null;
  const picked = variants[variants.length - 1];
  const videoItem = bookmark?.media?.find(
    (item) => item.media_type === 'video' || item.media_type === 'animated_gif',
  );
  return {
    type: 'mp4',
    url: picked.url,
    poster: videoItem?.preview_url ? unwrapProxiedMediaUrl(videoItem.preview_url) : null,
  };
}

export function resolveHlsPlayback(bookmark) {
  const hls = String(bookmark?.hls_manifest_url || '').trim();
  if (!/\.m3u8(?:[?#]|$)/i.test(hls)) return null;
  return {
    type: 'hls',
    url: unwrapProxiedMediaUrl(hls),
    poster: getBookmarkThumbnailUrl(bookmark),
  };
}

export function getBookmarkThumbnailUrl(bookmark) {
  const media = bookmark?.media ?? [];
  const video = media.find((item) => item.media_type === 'video' || item.media_type === 'animated_gif');
  if (video?.preview_url) return unwrapProxiedMediaUrl(video.preview_url);
  const photo = media.find((item) => item.media_type === 'photo');
  if (photo?.url) return unwrapProxiedMediaUrl(photo.url);
  return null;
}

/**
 * Prefer progressive MP4 (stable in UI). HLS is playback-only fallback and never shown as text.
 * @returns {{ type: 'hls' | 'mp4', url: string, poster?: string | null } | null}
 */
export function resolvePlaybackSource(bookmark) {
  const mp4 = resolveMp4Playback(bookmark);
  if (mp4) return mp4;
  return resolveHlsPlayback(bookmark);
}

export function isHeadlessSource(bookmark) {
  const slug = String(bookmark?.source_slug || 'x').trim() || 'x';
  return slug !== 'x';
}
