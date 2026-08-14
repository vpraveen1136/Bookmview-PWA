import { isMobileMediaProxyUrl } from './mediaProxyUrl.js';

/**
 * Wait until the service worker controls this page so mobile-media fetches
 * are proxied (otherwise SPA fallback returns HTML and video fails).
 */
export async function ensureMediaProxyReady(timeoutMs = 12000) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  if (navigator.serviceWorker.controller) return true;

  try {
    const registration = await navigator.serviceWorker.ready;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (navigator.serviceWorker.controller) return true;

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
  } catch {
    return false;
  }

  return Boolean(navigator.serviceWorker.controller);
}

/** Returns true when the URL can be loaded, or false after a failed wait. */
export async function ensureProxyForPlaybackUrl(url) {
  if (!isMobileMediaProxyUrl(url)) return true;
  return ensureMediaProxyReady();
}
