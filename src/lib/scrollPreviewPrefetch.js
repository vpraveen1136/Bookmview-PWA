import Hls from 'hls.js';

import {
  durationSecondsForPreview,
  ensureProxyForPreviewUrl,
  getBookmarkScrollPreviewSource,
  pickClipWindow,
  SCROLL_PREVIEW_PREFETCH_AHEAD,
  SCROLL_PREVIEW_PREFETCH_MIN_BUFFER_SEC,
  SCROLL_PREVIEW_PREFETCH_TIMEOUT_MS,
} from './scrollPreview.js';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function shouldPrefetch() {
  if (typeof document === 'undefined') return false;
  if (prefersReducedMotion()) return false;
  if (document.hidden) return false;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn?.saveData) return false;
  return true;
}

function canPlayNativeHls(video) {
  return video?.canPlayType('application/vnd.apple.mpegurl') !== '';
}

function configurePrefetchVideo(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.preload = 'auto';
  video.referrerPolicy = 'no-referrer';
}

function bufferedAheadSec(video, time) {
  const ranges = video.buffered;
  for (let i = 0; i < ranges.length; i += 1) {
    if (time >= ranges.start(i) && time <= ranges.end(i)) {
      return ranges.end(i) - time;
    }
  }
  return 0;
}

function waitForClipBuffered(video, clipStart, segmentEnd, timeoutMs) {
  const need = Math.min(
    SCROLL_PREVIEW_PREFETCH_MIN_BUFFER_SEC,
    Math.max(1, segmentEnd - clipStart),
  );

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    let rafId = null;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      video.removeEventListener('seeked', onSeeked);
      resolve(ok);
    };

    const deadline = Date.now() + timeoutMs;

    const check = () => {
      if (bufferedAheadSec(video, video.currentTime) >= need) {
        finish(true);
        return;
      }
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        finish(true);
        return;
      }
      if (Date.now() >= deadline) {
        finish(false);
        return;
      }
      rafId = requestAnimationFrame(check);
    };

    const onSeeked = () => check();

    const seek = () => {
      try {
        video.currentTime = clipStart;
      } catch {
        finish(false);
        return;
      }
      if (Math.abs(video.currentTime - clipStart) < 0.25) {
        check();
      }
    };

    video.addEventListener('seeked', onSeeked);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seek();
    } else {
      video.addEventListener('loadedmetadata', seek, { once: true });
    }

    timeoutId = window.setTimeout(() => finish(false), timeoutMs);
  });
}

class ScrollPreviewPrefetch {
  constructor() {
    this.bookmarksById = new Map();
    this.orderIds = [];
    this.activeIndex = -1;
    this.queue = [];
    this.ready = new Map();
    this.listeners = new Map();
    this.running = false;
    this.workerToken = 0;
    this.video = null;
    this.hls = null;
    this.hiddenVideoHost = null;
  }

  clear() {
    this.workerToken += 1;
    this.queue = [];
    this.orderIds = [];
    this.activeIndex = -1;
    this.bookmarksById.clear();
    this.ready.clear();
    this.teardownMedia();
  }

  /** Store playable queue order — does not prefetch the full list. */
  setQueue(bookmarks = []) {
    const ids = [];
    const nextBookmarks = new Map();

    for (const bookmark of bookmarks) {
      const id = bookmark?.tweet_id;
      if (!id) continue;
      ids.push(id);
      nextBookmarks.set(id, bookmark);
    }

    this.orderIds = ids;
    this.bookmarksById = nextBookmarks;

    for (const id of [...this.ready.keys()]) {
      if (!nextBookmarks.has(id)) this.ready.delete(id);
    }

    this.queue = [];
    if (this.activeIndex >= 0) {
      this.rebuildPrefetchWindow();
    }
  }

  getOrderIds() {
    return this.orderIds;
  }

  /** Slide the 5-item look-ahead window to the active queue position. */
  setActiveId(tweetId) {
    const id = String(tweetId || '').trim();
    if (!id) return;

    const idx = this.orderIds.indexOf(id);
    if (idx < 0) return;

    this.activeIndex = idx;
    this.releaseOutsideWindow();
    this.rebuildPrefetchWindow();
  }

  releaseOutsideWindow() {
    if (this.activeIndex < 0) return;

    const windowStart = this.activeIndex;
    const windowEnd = Math.min(
      this.activeIndex + SCROLL_PREVIEW_PREFETCH_AHEAD,
      this.orderIds.length - 1,
    );
    const keepIds = new Set(this.orderIds.slice(windowStart, windowEnd + 1));

    for (const readyId of [...this.ready.keys()]) {
      if (!keepIds.has(readyId)) {
        this.ready.delete(readyId);
      }
    }
  }

  rebuildPrefetchWindow() {
    if (this.activeIndex < 0 || !this.orderIds.length) {
      this.queue = [];
      return;
    }

    const windowEnd = Math.min(
      this.activeIndex + SCROLL_PREVIEW_PREFETCH_AHEAD,
      this.orderIds.length - 1,
    );

    const toPrefetch = [];
    for (let i = this.activeIndex; i <= windowEnd; i += 1) {
      const id = this.orderIds[i];
      if (!this.ready.has(id)) toPrefetch.push(id);
    }

    this.queue = toPrefetch;
    this.workerToken += 1;
    this.running = false;
    this.kick();
  }

  /** @deprecated use setActiveId */
  prioritize(tweetId) {
    this.setActiveId(tweetId);
  }

  getClip(tweetId) {
    return this.ready.get(String(tweetId || '').trim()) || null;
  }

  subscribe(tweetId, listener) {
    const id = String(tweetId || '').trim();
    if (!id || typeof listener !== 'function') return () => {};

    const set = this.listeners.get(id) || new Set();
    set.add(listener);
    this.listeners.set(id, set);

    const cached = this.ready.get(id);
    if (cached) listener(cached);

    return () => {
      const bucket = this.listeners.get(id);
      if (bucket) {
        bucket.delete(listener);
        if (!bucket.size) this.listeners.delete(id);
      }
    };
  }

  notifyReady(id, clip) {
    this.ready.set(id, clip);
    const bucket = this.listeners.get(id);
    if (bucket) {
      bucket.forEach((fn) => {
        try {
          fn(clip);
        } catch {
          // ignore listener errors
        }
      });
    }
  }

  ensureWorkerVideo() {
    if (this.video) return this.video;

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none';
    document.body.appendChild(host);
    this.hiddenVideoHost = host;

    const video = document.createElement('video');
    configurePrefetchVideo(video);
    host.appendChild(video);
    this.video = video;
    return video;
  }

  teardownMedia() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }
  }

  kick() {
    if (this.running || !this.queue.length) return;
    if (!shouldPrefetch()) {
      window.setTimeout(() => this.kick(), 400);
      return;
    }
    this.running = true;
    const token = this.workerToken;
    this.runWorker(token);
  }

  async runWorker(token) {
    while (this.queue.length > 0 && token === this.workerToken) {
      if (!shouldPrefetch()) {
        await new Promise((r) => window.setTimeout(r, 300));
        continue;
      }

      const id = this.queue.shift();
      if (!this.isInPrefetchWindow(id)) continue;

      const bookmark = this.bookmarksById.get(id);
      if (!bookmark || this.ready.has(id)) continue;

      await this.prefetchOne(id, bookmark, token);
    }

    if (token === this.workerToken) {
      this.running = false;
      if (this.queue.length) this.kick();
    }
  }

  isInPrefetchWindow(id) {
    if (this.activeIndex < 0) return false;
    const idx = this.orderIds.indexOf(id);
    if (idx < 0) return false;
    return idx >= this.activeIndex
      && idx <= this.activeIndex + SCROLL_PREVIEW_PREFETCH_AHEAD;
  }

  async prefetchOne(id, bookmark, token) {
    const source = getBookmarkScrollPreviewSource(bookmark);
    if (!source?.url) return false;

    const proxyReady = await ensureProxyForPreviewUrl(source.url);
    if (!proxyReady || token !== this.workerToken) return false;
    if (!this.isInPrefetchWindow(id)) return false;

    this.teardownMedia();
    const video = this.ensureWorkerVideo();
    configurePrefetchVideo(video);

    const durationSec = durationSecondsForPreview(bookmark, null);
    const { clipStart, segmentEnd } = pickClipWindow(durationSec);

    try {
      if (source.type === 'hls') {
        const loaded = await this.loadHls(video, source.url, token);
        if (!loaded || token !== this.workerToken) return false;
      } else {
        await this.loadMp4(video, source.url, token);
        if (token !== this.workerToken) return false;
      }

      if (!this.isInPrefetchWindow(id)) return false;

      const buffered = await waitForClipBuffered(
        video,
        clipStart,
        segmentEnd,
        SCROLL_PREVIEW_PREFETCH_TIMEOUT_MS,
      );

      if (token !== this.workerToken || !this.isInPrefetchWindow(id)) return false;

      this.notifyReady(id, {
        ready: true,
        tweetId: id,
        type: source.type,
        url: source.url,
        clipStart,
        segmentEnd,
        buffered,
      });
      return true;
    } catch {
      return false;
    }
  }

  loadMp4(video, url, token) {
    return new Promise((resolve) => {
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('error', onError);
        resolve(token === this.workerToken);
      };
      const onError = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('error', onError);
        resolve(false);
      };
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('error', onError);
      video.src = url;
      video.load();
    });
  }

  loadHls(video, url, token) {
    return new Promise((resolve) => {
      if (canPlayNativeHls(video)) {
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onError);
          resolve(token === this.workerToken);
        };
        const onError = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onError);
          resolve(false);
        };
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('error', onError);
        video.src = url;
        video.load();
        return;
      }

      if (!Hls.isSupported()) {
        resolve(false);
        return;
      }

      const hls = new Hls({
        enableWorker: false,
        maxBufferLength: 6,
        maxMaxBufferLength: 10,
      });
      this.hls = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (token !== this.workerToken) {
          resolve(false);
          return;
        }
        resolve(true);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data?.fatal) resolve(false);
      });
    });
  }
}

export const scrollPreviewPrefetch = new ScrollPreviewPrefetch();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scrollPreviewPrefetch.kick();
  });
}
