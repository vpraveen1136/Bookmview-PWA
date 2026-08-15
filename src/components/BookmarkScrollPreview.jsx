import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

import { ensureProxyForPlaybackUrl } from '../lib/mediaProxyReady.js';
import { getBookmarkThumbnailUrl } from '../lib/playback.js';
import {
  durationSecondsForPreview,
  getBookmarkScrollPreviewSource,
  pickRandomClipStart,
  PREVIEW_CLIP_SECONDS,
  SCROLL_PREVIEW_ACTIVATE_MS,
} from '../lib/scrollPreview.js';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function canPlayNativeHls(video) {
  if (!video) return false;
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
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
  const delayRef = useRef(null);
  const segmentEndRef = useRef(PREVIEW_CLIP_SECONDS);
  const bookmarkRef = useRef(bookmark);
  bookmarkRef.current = bookmark;

  const thumbnailUrl = getBookmarkThumbnailUrl(bookmark);
  const preview = getBookmarkScrollPreviewSource(bookmark);
  const canPreview = Boolean(preview) && !disabled;

  const teardown = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
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
    setPreviewVisible(false);
  }, []);

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
      maxBufferLength: 6,
      maxMaxBufferLength: 10,
    });
    hlsRef.current = hls;
    hls.loadSource(manifestUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data?.fatal) teardown();
    });
    return true;
  }, [teardown]);

  const startPreview = useCallback(async () => {
    if (!preview || !videoRef.current) return;

    const proxyReady = await ensureProxyForPlaybackUrl(preview.url);
    if (!proxyReady) return;

    const video = videoRef.current;
    video.muted = true;
    video.playsInline = true;
    video.defaultMuted = true;
    video.referrerPolicy = 'no-referrer';

    const seekAndPlay = () => {
      seekToRandomClip(video);
      video.play()
        .then(() => setPreviewVisible(true))
        .catch(() => teardown());
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
        teardown();
        return;
      }
      if (hlsRef.current) {
        hlsRef.current.on(Hls.Events.MANIFEST_PARSED, seekAndPlay);
      } else {
        video.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      }
    }
  }, [preview, seekToRandomClip, startHls, teardown]);

  useEffect(() => {
    if (!active || !canPreview || prefersReducedMotion()) {
      teardown();
      return undefined;
    }

    delayRef.current = window.setTimeout(() => {
      delayRef.current = null;
      startPreview();
    }, SCROLL_PREVIEW_ACTIVATE_MS);

    return () => teardown();
  }, [active, canPreview, bookmark?.tweet_id, preview?.url, startPreview, teardown]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewVisible) return undefined;

    const onTimeUpdate = () => {
      if (video.currentTime >= segmentEndRef.current - 0.15) {
        seekToRandomClip(video);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [previewVisible, seekToRandomClip]);

  useEffect(() => () => teardown(), [teardown]);

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
