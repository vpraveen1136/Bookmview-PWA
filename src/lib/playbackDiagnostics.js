import { getMediaFetchOptions, isMobileMediaProxyUrl } from './mediaProxyUrl.js';
import { unwrapProxiedMediaUrl } from './playback.js';

function shortUrl(url) {
  const value = String(url || '');
  if (value.length <= 96) return value;
  return `${value.slice(0, 48)}…${value.slice(-40)}`;
}

export async function diagnosePlaybackUrl(playbackUrl) {
  if (!playbackUrl) {
    return 'No playback URL was generated for this item.';
  }

  const label = shortUrl(unwrapProxiedMediaUrl(playbackUrl));
  const usesSwProxy = isMobileMediaProxyUrl(playbackUrl);

  if (usesSwProxy && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    if (!navigator.serviceWorker.controller) {
      return `Media proxy offline (service worker not controlling this page). URL: ${label}`;
    }
  }

  if (usesSwProxy && typeof navigator !== 'undefined' && !('serviceWorker' in navigator)) {
    return 'This browser cannot run the media proxy. Use Safari and Add to Home Screen.';
  }

  try {
    const response = await fetch(playbackUrl, getMediaFetchOptions(playbackUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-4095' },
    }));

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const status = response.status;

    if (status === 403) {
      return `CDN refused the request (HTTP 403). Twitter blocks embeds that send the PWA origin as Referer. URL: ${label}`;
    }

    if (status === 502 || contentType.includes('text/html') || contentType.includes('text/plain')) {
      let body = '';
      try {
        body = (await response.text()).slice(0, 160);
      } catch {
        body = '';
      }
      if (/expired|web page|blocked/i.test(body)) {
        return `HTTP ${status} (${contentType || 'text'}): CDN returned a web page, not video. URL: ${label}`;
      }
      return `HTTP ${status} (${contentType || 'unknown'}): ${body || 'non-video response'}. URL: ${label}`;
    }

    if (status >= 400 && status !== 206) {
      return `CDN refused the request (HTTP ${status}, type ${contentType || 'unknown'}). URL: ${label}`;
    }

    if (contentType.includes('video/mp4') || contentType.includes('video/quicktime') || status === 206) {
      return `CDN returned playable MP4 (HTTP ${status}, ${contentType || 'video'}), but the <video> element still failed. URL: ${label}. Pull to refresh after updating the PWA.`;
    }

    if (contentType.includes('video/webm')) {
      return `This quality is WebM (HTTP ${status}), which iPhone Safari cannot play. URL: ${label}`;
    }

    return `Unexpected response (HTTP ${status}, type ${contentType || 'unknown'}). URL: ${label}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network error';
    return `Could not load media (${message}). URL: ${label}`;
  }
}
