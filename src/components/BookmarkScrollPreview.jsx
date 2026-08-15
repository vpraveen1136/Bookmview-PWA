import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

import { ensureMediaProxyReady } from '../lib/mediaProxyReady.js';
import { isMobileMediaProxyUrl } from '../lib/mediaProxyUrl.js';
import { getBookmarkThumbnailUrl } from '../lib/playback.js';
import {
  durationSecondsForPreview,
  getBookmarkScrollPreviewSource,
  pickRandomClipStart,
  PREVIEW_CLIP_SECONDS,
  SCROLL_PREVIEW_PROXY_TIMEOUT_MS,
} from '../lib/scrollPreview.js';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function canPlayNativeHls(video) {
  if (!video) return false;
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

async function ensureProxyForPreview(url) {
  if (!isMobileMediaProxyUrl(url)) return true;
  return ensureMediaProxyReady(SCROLL_PREVIEW_PROXY_TIMEOUT_MS);
}

function BookmarkScrollPreviewComponent({
  bookmark,
  active = false,
  disabled = false,
  placeholder = 'Video',
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const segmentEndRef = useRef(PREVIEW_CLIP_SECONDS);
  const bookmarkRef = useRef(bookmark);
  const activeRef = useRef(active);
  const loadedRef = useRef(false);
  const hardTeardownTimerRef = useRef(null);
  bookmarkRef.current = bookmark;
  activeRef.current = active;

  const thumbnailUrl = getBookmarkThumbnailUrl(bookmark);
  const preview = getBookmarkScrollPreviewSource(bookmark);
  const canPreview = Boolean(preview) && !disabled;

  const hardTeardown = useCallback(() => {
    if (hardTeardownTimerRef.current) {
      clearTimeout(hardTeardownTimerRef.current);
      hardTeardownTimerRef.current = null;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    loadedRef.current = false;
    setPreviewVisible(false);
  }, []);

  const softPause = useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    setPreviewVisible(false);
  }, []);

  const scheduleHardTeardown = useCallback(() => {
    if (hardTeardownTimerRef.current) {
      clearTimeout(hardTeardownTimerRef.current);
    }
    hardTeardownTimerRef.current = window.setTimeout(() => {
      hardTeardownTimerRef.current = null;
      if (!activeRef.current) hardTeardown();
    }, 1500);
  }, [hardTeardown]);

  const seekToRandomClip = useCallback((video) => {
    const durationSec = durationSecondsForPreview(bookmarkRef.current, video);
    const start = pickRandomClipStart(durationSec);
    segmentEndRef.current = durationSec
      ? Math.min(start + PREVIEW_CLIP_SECONDS, durationSec)
      : start + PREVIEW_CLIP_SECONDS;
    try {
      video.currentTime = start;
    } catch {
      // Seek may fail until the stream has buffered.
    }
  }, []);

  const startHls = useCallback((video, manifestUrl) => {
    video.referrerPolicy = 'no-referrer';

    if (canPlayNativeHls(video)) {
      video.src = manifestUrl;
      video.load();
      return true;
    }

    if (!Hls.isSupported()) return false;

    const hls = new Hls({
      enableWorker: false,
      maxBufferLength: 4,
      maxMaxBufferLength: 8,
    });
    hlsRef.current = hls;
    hls.loadSource(manifestUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data?.fatal) hardTeardown();
    });
    return true;
  }, [hardTeardown]);

  const playLoaded = useCallback(() => {
    const video = videoRef.current;
    if (!video || !activeRef.current) return;

    seekToRandomClip(video);
    video.play()
      .then(() => {
        if (activeRef.current) setPreviewVisible(true);
      })
      .catch(() => {
        if (!activeRef.current) return;
        hardTeardown();
      });
  }, [hardTeardown, seekToRandomClip]);

  const startPreview = useCallback(async () => {
    if (!preview || !videoRef.current || !activeRef.current) return;

    if (hardTeardownTimerRef.current) {
      clearTimeout(hardTeardownTimerRef.current);
      hardTeardownTimerRef.current = null;
    }

    const proxyReady = await ensureProxyForPreview(preview.url);
    if (!proxyReady || !activeRef.current) return;

    const video = videoRef.current;
    video.muted = true;
    video.playsInline = true;
    video.defaultMuted = true;
    video.referrerPolicy = 'no-referrer';

    if (loadedRef.current && (video.src || hlsRef.current)) {
      playLoaded();
      return;
    }

    const seekAndPlay = () => {
      loadedRef.current = true;
      playLoaded();
    };

    if (preview.type === 'mp4') {
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        seekAndPlay();
      };
      video.addEventListener('loadedmetadata', onMeta);
      video.src = preview.url;
      video.load();
      return;
    }

    if (preview.type === 'hls') {
      if (!startHls(video, preview.url)) {
        hardTeardown();
        return;
      }
      if (hlsRef.current) {
        hlsRef.current.on(Hls.Events.MANIFEST_PARSED, seekAndPlay);
      } else {
        video.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      }
    }
  }, [preview, playLoaded, startHls, hardTeardown]);

  useEffect(() => {
    if (!canPreview || prefersReducedMotion()) {
      hardTeardown();
      return undefined;
    }

    if (active) {
      startPreview();
      return () => {
        softPause();
        scheduleHardTeardown();
      };
    }

    softPause();
    scheduleHardTeardown();
    return undefined;
  }, [
    active,
    canPreview,
    bookmark?.tweet_id,
    preview?.url,
    startPreview,
    hardTeardown,
    softPause,
    scheduleHardTeardown,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewVisible) return undefined;

    const onTimeUpdate = () => {
      if (!activeRef.current) return;
      if (video.currentTime >= segmentEndRef.current - 0.15) {
        seekToRandomClip(video);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [previewVisible, seekToRandomClip]);

  useEffect(() => () => hardTeardown(), [hardTeardown]);

  const showImage = thumbnailUrl && !imageFailed;

  return (
    <div className="thumb-scroll-preview">
      {showImage ? (
        <img
          className={`thumb thumb-scroll-preview-img ${previewVisible ? 'is-hidden' : ''}`}
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={`thumb thumb-placeholder ${previewVisible ? 'is-hidden' : ''}`}>
          {placeholder}
        </div>
      )}
      {canPreview ? (
        <video
          ref={videoRef}
          className={`thumb-scroll-preview-video ${previewVisible ? 'is-visible' : ''}`}
          muted
          playsInline
          preload="none"
          tabIndex={-1}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export const BookmarkScrollPreview = memo(BookmarkScrollPreviewComponent);
