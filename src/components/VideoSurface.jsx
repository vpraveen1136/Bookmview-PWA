import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

import { diagnosePlaybackUrl } from '../lib/playbackDiagnostics.js';
import { isTwimgCdnUrl } from '../lib/mediaProxyUrl.js';
import { ensureProxyForPlaybackUrl } from '../lib/mediaProxyReady.js';
import { getPlaybackPosition, setPlaybackPosition } from '../lib/watchPlaybackPosition.js';
import { WatchSeekBar } from './WatchSeekBar.jsx';
import { WatchBottomToolbar } from './WatchBottomToolbar.jsx';

function canPlayNativeHls(video) {
  if (!video) return false;
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

function friendlyError(message) {
  const text = String(message || '');
  if (/HTTP 403|blocked.*Referer|CDN refused.*403/i.test(text)) {
    return {
      short: 'CDN blocked this app',
      detail: text,
      hint: 'Update the PWA, pull to refresh, then reopen from the Home Screen icon.',
    };
  }
  if (/playable MP4.*video.*still failed/i.test(text)) {
    return {
      short: 'Video frame rejected MP4',
      detail: text,
      hint: 'The link works in Safari — pull to refresh after updating the PWA (no-referrer fix).',
    };
  }
  if (/expired|blocked|HTTP 40[13]|refused|web page instead/i.test(text)) {
    return {
      short: 'Media link expired',
      detail: text,
      hint: 'Refresh this video on your desktop, then re-export bookmview.db to your phone.',
    };
  }
  return {
    short: 'Could not play video',
    detail: text,
    hint: 'Try playback settings (⋮) or refresh on desktop.',
  };
}

export function VideoSurface({
  source,
  onError,
  className = '',
  isActive = true,
  showControls = false,
  chromeVisible = false,
  showTitle = false,
  titleMeta = null,
  muted: mutedProp = true,
  tweetId = null,
  posterUrl = null,
  onPlayingChange,
  onScrubbingChange,
  qualityProps = null,
  seekApiRef = null,
}) {
  const videoRef = useRef(null);
  const surfaceRef = useRef(null);
  const hlsRef = useRef(null);
  const [errorText, setErrorText] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [needsTapPlay, setNeedsTapPlay] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(Boolean(mutedProp));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [seekFlash, setSeekFlash] = useState(null);
  const diagnoseToken = useRef(0);
  const fallbackState = useRef({ step: 0 });
  const lastPersist = useRef(0);
  const onErrorRef = useRef(onError);
  const initialSeekDoneRef = useRef(null);

  onErrorRef.current = onError;

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.referrerPolicy = 'no-referrer';
    }
  }, []);

  const tryPlayActive = (video) => {
    if (!video || !isActive) return;
    const playPromise = video.play();
    if (playPromise?.catch) {
      playPromise.catch(() => setNeedsTapPlay(true));
    } else {
      setNeedsTapPlay(false);
    }
  };

  useEffect(() => {
    setErrorText('');
    setErrorDetail('');
    setNeedsTapPlay(false);
    setPaused(false);
    const video = videoRef.current;
    if (!video || !source?.url) return undefined;

    let cancelled = false;

    const buildPlan = (src) => {
      const plan = [];
      const seen = new Set();
      const add = (entry) => {
        if (!entry?.url) return;
        const key = `${entry.type || 'mp4'}::${entry.url}`;
        if (seen.has(key)) return;
        seen.add(key);
        plan.push({ type: entry.type || 'mp4', url: entry.url });
      };
      add(src);
      if (src.proxyUrl) add({ type: 'mp4', url: src.proxyUrl });
      for (const alt of src.alternates || []) {
        add(alt);
        if (alt.proxyUrl) add({ type: 'mp4', url: alt.proxyUrl });
      }
      return plan;
    };

    const plan = buildPlan(source);
    fallbackState.current = { index: 0 };

    const reportError = (message) => {
      const friendly = friendlyError(message);
      setErrorText(friendly.short);
      setErrorDetail(friendly.detail || message);
      onErrorRef.current?.(friendly.short, friendly.detail || message);
    };

    const reportWithDiagnosis = async (fallbackMessage, urlToCheck) => {
      const token = ++diagnoseToken.current;
      const friendly = friendlyError(fallbackMessage);
      setErrorText(friendly.short);
      setErrorDetail('Checking link…');
      const detail = await diagnosePlaybackUrl(urlToCheck || source.url);
      if (token === diagnoseToken.current && !cancelled) {
        const diagnosed = friendlyError(detail);
        setErrorText(diagnosed.short);
        setErrorDetail(diagnosed.detail || detail);
        onErrorRef.current?.(diagnosed.short, diagnosed.detail || detail);
      }
    };

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const tryPlay = () => {
      if (!isActive || cancelled) return;
      const playPromise = video.play();
      if (playPromise?.catch) {
        playPromise.catch(() => {
          if (isActive && !cancelled) setNeedsTapPlay(true);
        });
      }
    };

    const loadMp4 = (url) => {
      video.removeAttribute('src');
      video.load();
      video.referrerPolicy = 'no-referrer';
      video.src = url;
      if (source.poster) video.poster = source.poster;
      tryPlay();
    };

    const onLoaded = () => {
      if (initialSeekDoneRef.current === tweetId) {
        tryPlay();
        return;
      }
      initialSeekDoneRef.current = tweetId;
      const saved = tweetId ? getPlaybackPosition(tweetId) : 0;
      if (saved > 0 && Number.isFinite(video.duration) && saved < video.duration - 2) {
        try {
          video.currentTime = saved;
        } catch {
          // ignore
        }
      }
      tryPlay();
    };

    const tryNextPlanEntry = () => {
      const nextIndex = fallbackState.current.index + 1;
      if (nextIndex >= plan.length) return false;
      fallbackState.current.index = nextIndex;
      loadPlanEntry(plan[nextIndex]);
      return true;
    };

    const onVideoError = () => {
      if (cancelled) return;
      if (tryNextPlanEntry()) return;
      const current = video.currentSrc || plan[fallbackState.current.index]?.url || source.url;
      reportWithDiagnosis('Video failed to load.', current);
    };

    const loadPlanEntry = async (entry) => {
      const proxyReady = await ensureProxyForPlaybackUrl(entry.url);
      if (cancelled) return;

      if (!proxyReady) {
        reportError(
          'Media proxy is offline. Pull to refresh this page, wait a few seconds, then open again from the Home Screen icon.',
        );
        return;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      video.removeEventListener('error', onVideoError);
      video.removeEventListener('loadedmetadata', onLoaded);

      if (entry.type === 'hls') {
        video.removeAttribute('src');
        video.load();
        video.referrerPolicy = 'no-referrer';

        if (canPlayNativeHls(video)) {
          video.src = entry.url;
          video.addEventListener('loadedmetadata', onLoaded, { once: true });
          video.addEventListener('error', onVideoError);
          tryPlay();
          return;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, maxBufferLength: isActive ? 30 : 8 });
          if (cancelled) {
            hls.destroy();
            return;
          }
          hlsRef.current = hls;
          hls.loadSource(entry.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) onLoaded();
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal && !cancelled) {
              if (!tryNextPlanEntry()) {
                reportWithDiagnosis('HLS playback failed.', entry.url);
              }
            }
          });
          return;
        }

        if (!tryNextPlanEntry()) {
          reportError('This browser cannot play HLS streams.');
        }
        return;
      }

      loadMp4(entry.url);
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onVideoError);
    };

    if (plan.length) {
      loadPlanEntry(plan[0]);
    }

    return () => {
      cancelled = true;
      video.removeEventListener('error', onVideoError);
      video.removeEventListener('loadedmetadata', onLoaded);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isActive, source?.url, source?.type, source?.cdnUrl, source?.proxyUrl, source?.alternates, tweetId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.defaultMuted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.playbackRate = playbackRate;
    } catch {
      // ignore
    }
  }, [playbackRate]);

  useEffect(() => {
    initialSeekDoneRef.current = null;
  }, [tweetId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (!isActive) {
      video.pause();
      if (hlsRef.current) {
        hlsRef.current.stopLoad();
      }
      return undefined;
    }

    if (hlsRef.current) {
      hlsRef.current.startLoad();
    }
    tryPlayActive(video);

    const onTimeUpdate = () => {
      if (!tweetId || !isActive) return;
      const now = Date.now();
      if (now - lastPersist.current < 2000) return;
      lastPersist.current = now;
      if (video.currentTime > 1) {
        setPlaybackPosition(tweetId, video.currentTime);
      }
    };

    const onPlay = () => {
      setPaused(false);
      setNeedsTapPlay(false);
      onPlayingChange?.(true);
    };
    const onPause = () => {
      setPaused(true);
      onPlayingChange?.(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [isActive, onPlayingChange, tweetId]);

  useEffect(() => () => {
    const video = videoRef.current;
    if (video && tweetId && video.currentTime > 1) {
      setPlaybackPosition(tweetId, video.currentTime);
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, [tweetId]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    if (video.paused) {
      tryPlayActive(video);
    } else {
      video.pause();
    }
  };

  const seekBy = useCallback((deltaSeconds) => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    const duration = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
    const next = Math.min(duration, Math.max(0, (video.currentTime || 0) + deltaSeconds));
    try {
      video.currentTime = next;
    } catch {
      // ignore
    }
    setSeekFlash(deltaSeconds);
    window.setTimeout(() => setSeekFlash(null), 650);
  }, [isActive]);

  useEffect(() => {
    if (!seekApiRef) return undefined;
    if (isActive) {
      seekApiRef.current = { seekBy };
    } else if (seekApiRef.current?.seekBy === seekBy) {
      seekApiRef.current = null;
    }
    return () => {
      if (seekApiRef.current?.seekBy === seekBy) {
        seekApiRef.current = null;
      }
    };
  }, [isActive, seekApiRef, seekBy]);

  const toggleMute = () => {
    const video = videoRef.current;
    const next = !muted;
    setMuted(next);
    if (video) {
      video.muted = next;
      video.defaultMuted = next;
      if (!next) {
        tryPlayActive(video);
      }
    }
  };

  const readFullscreenState = () => {
    const video = videoRef.current;
    return Boolean(
      document.fullscreenElement
      || document.webkitFullscreenElement
      || video?.webkitDisplayingFullscreen,
    );
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(readFullscreenState());
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    const video = videoRef.current;
    video?.addEventListener?.('webkitbeginfullscreen', onFsChange);
    video?.addEventListener?.('webkitendfullscreen', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      video?.removeEventListener?.('webkitbeginfullscreen', onFsChange);
      video?.removeEventListener?.('webkitendfullscreen', onFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    const video = videoRef.current;
    const root = surfaceRef.current;
    if (!video) return;

    try {
      if (readFullscreenState()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (video.webkitExitFullscreen) video.webkitExitFullscreen();
        setIsFullscreen(false);
        return;
      }

      // iOS Safari: native video fullscreen is the reliable path.
      if (typeof video.webkitEnterFullscreen === 'function') {
        video.webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      }

      if (root?.requestFullscreen) {
        await root.requestFullscreen();
      } else if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (root?.webkitRequestFullscreen) {
        root.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch {
      // user gesture / policy blocked
    }
  };

  const controlsShown = Boolean(chromeVisible || showControls);

  return (
    <div className={`video-surface ${controlsShown ? 'chrome-visible' : ''} ${className}`} ref={surfaceRef}>
      <div className="video-wrap video-wrap-immersive">
        <video
          ref={videoRef}
          controls={false}
          playsInline
          muted={muted}
          referrerPolicy="no-referrer"
          crossOrigin={source?.cdnUrl && isTwimgCdnUrl(source.cdnUrl) ? 'anonymous' : undefined}
          preload={isActive ? 'auto' : 'metadata'}
          controlsList="nodownload"
          poster={source?.poster || posterUrl || undefined}
        />
      </div>

      {isActive && seekFlash ? (
        <div
          className={`watch-seek-flash ${seekFlash > 0 ? 'is-forward' : 'is-back'}`}
          aria-hidden="true"
        >
          {seekFlash > 0 ? '+10s' : '−10s'}
        </div>
      ) : null}

      {isActive && controlsShown && showTitle && titleMeta ? (
        <div className="watch-title-banner watch-chrome-fade is-visible" onClick={(e) => e.stopPropagation()}>
          <span className="watch-source-pill">{titleMeta.source}</span>
          <p className="watch-title-overlay">{titleMeta.title}</p>
        </div>
      ) : null}

      {isActive && !errorText && controlsShown && (paused || needsTapPlay) ? (
        <button
          type="button"
          className="watch-center-play watch-chrome-fade is-visible"
          aria-label="Play"
          onClick={(event) => {
            event.stopPropagation();
            togglePlayPause();
          }}
        >
          ▶
        </button>
      ) : null}

      {isActive && !errorText && controlsShown && !paused && !needsTapPlay ? (
        <button
          type="button"
          className="watch-center-play watch-center-play-pause watch-chrome-fade is-visible"
          aria-label="Pause"
          onClick={(event) => {
            event.stopPropagation();
            togglePlayPause();
          }}
        >
          ❚❚
        </button>
      ) : null}

      {isActive && !errorText && !controlsShown && needsTapPlay ? (
        <button
          type="button"
          className="watch-center-play watch-center-play-hint"
          aria-label="Play"
          onClick={(event) => {
            event.stopPropagation();
            togglePlayPause();
          }}
        >
          ▶
        </button>
      ) : null}

      {errorText ? (
        <div className="playback-error playback-error-compact" role="alert">
          <p className="playback-error-title">{errorText}</p>
          <p className="playback-error-hint">{friendlyError(errorDetail).hint}</p>
        </div>
      ) : null}

      {isActive && !errorText ? (
        <div
          className={`watch-controls-bottom watch-chrome-fade ${controlsShown ? 'is-visible' : ''}`}
          aria-hidden={!controlsShown}
        >
          <div className="watch-controls-header">
            <button
              type="button"
              className={`watch-title-toggle ${showTitle ? 'is-active' : ''}`}
              aria-label="Toggle title"
              aria-pressed={showTitle}
              tabIndex={controlsShown ? 0 : -1}
              onClick={(event) => {
                event.stopPropagation();
                titleMeta?.onToggleTitle?.();
              }}
            >
              T
            </button>
          </div>
          <WatchSeekBar
            videoRef={videoRef}
            onScrubbingChange={onScrubbingChange}
          />
          <WatchBottomToolbar
            muted={muted}
            isFullscreen={isFullscreen}
            onToggleMute={toggleMute}
            onToggleFullscreen={toggleFullscreen}
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
            qualityProps={qualityProps}
            onPickerOpenChange={onScrubbingChange}
          />
        </div>
      ) : null}
    </div>
  );
}
