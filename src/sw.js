/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && !url.pathname.includes('mobile-media'),
  createHandlerBoundToURL('index.html'),
);

const TWITTER_REFERER = 'https://x.com/';
const CONTENT_LENGTH_CACHE_TTL_MS = 60 * 60 * 1000;

/** @type {Map<string, { length: number, expiresAt: number }>} */
const contentLengthCache = new Map();

function isMobileMediaRequest(url) {
  return url.pathname.includes('mobile-media');
}

function isTwimgTarget(target) {
  return /^https:\/\/(video|pbs|ton)\.twimg\.com\//i.test(String(target || ''));
}

function isAllowedTarget(target) {
  if (!target || typeof target !== 'string') return false;
  try {
    const parsed = new URL(target);
    if (isTwimgTarget(target)) return true;
    if (/\.sb-cd\.com$/i.test(parsed.hostname) || parsed.hostname.includes('sb-cd.com')) return true;
    if (/[?&]secure=/i.test(target) && /\.mp4/i.test(target)) return true;
  } catch {
    return false;
  }
  return false;
}

function pickReferer(target, refParam) {
  if (isTwimgTarget(target)) return TWITTER_REFERER;
  if (refParam && /^https?:\/\//i.test(refParam)) return refParam;
  if (/sb-cd\.com/i.test(target)) return 'https://spankbang.com/';
  return TWITTER_REFERER;
}

function buildUpstreamHeaders(target, refParam, request) {
  const headers = new Headers();
  headers.set('Referer', pickReferer(target, refParam));
  if (isTwimgTarget(target)) {
    headers.set('Origin', 'https://x.com');
  }
  headers.set(
    'User-Agent',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );
  headers.set('Accept', '*/*');

  const range = request.headers.get('Range');
  if (range) headers.set('Range', range);
  const ifRange = request.headers.get('If-Range');
  if (ifRange) headers.set('If-Range', ifRange);

  return headers;
}

function parseContentRange(value) {
  if (!value || typeof value !== 'string') return null;
  const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(value.trim());
  if (!match) return null;
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: match[3] === '*' ? null : Number(match[3]),
  };
}

async function resolveFullContentLength(target, refParam) {
  const cached = contentLengthCache.get(target);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.length;
  }

  const headers = buildUpstreamHeaders(target, refParam, { headers: new Headers() });
  const upstream = await fetch(target, { method: 'HEAD', headers, redirect: 'follow' });
  const length = Number(upstream.headers.get('content-length'));
  if (!Number.isFinite(length) || length <= 0) return null;

  contentLengthCache.set(target, {
    length,
    expiresAt: Date.now() + CONTENT_LENGTH_CACHE_TTL_MS,
  });
  return length;
}

async function repairContentRangeHeader(target, refParam, upstreamHeaders) {
  const parsed = parseContentRange(upstreamHeaders.get('content-range'));
  if (!parsed) return upstreamHeaders;

  const chunkBytes = parsed.end - parsed.start + 1;
  const reportedTotal = parsed.total;
  const looksTruncated = !reportedTotal
    || reportedTotal <= parsed.end
    || reportedTotal <= chunkBytes;

  if (!looksTruncated) return upstreamHeaders;

  const fullLength = await resolveFullContentLength(target, refParam);
  if (!fullLength || fullLength <= parsed.end) return upstreamHeaders;

  const repaired = new Headers(upstreamHeaders);
  repaired.set('content-range', `bytes ${parsed.start}-${parsed.end}/${fullLength}`);
  return repaired;
}

async function proxyMobileMedia(request) {
  const clientUrl = new URL(request.url);
  const target = clientUrl.searchParams.get('u');
  const refParam = clientUrl.searchParams.get('ref');

  if (!isAllowedTarget(target)) {
    return new Response('Invalid or missing media URL', { status: 400 });
  }

  const headers = buildUpstreamHeaders(target, refParam, request);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      redirect: 'follow',
    });
  } catch (error) {
    return new Response(`Upstream fetch failed: ${error instanceof Error ? error.message : 'error'}`, {
      status: 502,
    });
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    return new Response('Media URL returned a web page (expired or blocked). Refresh on desktop and re-export the database.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const status = upstream.status;
  if (status >= 400 && status !== 206) {
    return new Response(`Upstream media error (${status})`, { status });
  }

  let outHeaders = new Headers();
  for (const key of [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
  ]) {
    const value = upstream.headers.get(key);
    if (value) outHeaders.set(key, value);
  }

  if (status === 206) {
    outHeaders = await repairContentRangeHeader(target, refParam, outHeaders);
  }

  if (!outHeaders.get('content-type') && /\.mp4/i.test(target)) {
    outHeaders.set('Content-Type', 'video/mp4');
  }
  if (!outHeaders.get('accept-ranges')) {
    outHeaders.set('Accept-Ranges', 'bytes');
  }

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

registerRoute(
  ({ url }) => isMobileMediaRequest(url),
  ({ request }) => proxyMobileMedia(request),
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
