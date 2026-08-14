import { useCallback, useEffect, useRef, useState } from 'react';

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WatchSeekBar({
  videoRef,
  onScrubbingChange,
}) {
  const trackRef = useRef(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const scrubbingRef = useRef(false);

  const syncFromVideo = useCallback(() => {
    const video = videoRef?.current;
    if (!video || scrubbingRef.current) return;
    setCurrent(video.currentTime || 0);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    try {
      const ranges = video.buffered;
      if (ranges?.length) {
        setBufferedEnd(ranges.end(ranges.length - 1));
      }
    } catch {
      // ignore
    }
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return undefined;
    syncFromVideo();
    const onTime = () => syncFromVideo();
    const onMeta = () => syncFromVideo();
    const onProgress = () => syncFromVideo();
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('progress', onProgress);
    video.addEventListener('seeked', onTime);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('seeked', onTime);
    };
  }, [syncFromVideo, videoRef]);

  const valueFromClientX = (clientX) => {
    const el = trackRef.current;
    const video = videoRef?.current;
    if (!el || !video || !Number.isFinite(video.duration) || video.duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * video.duration;
  };

  const beginScrub = (clientX) => {
    const next = valueFromClientX(clientX);
    scrubbingRef.current = true;
    setDragging(true);
    setDragValue(next);
    onScrubbingChange?.(true);
  };

  const moveScrub = (clientX) => {
    if (!scrubbingRef.current) return;
    setDragValue(valueFromClientX(clientX));
  };

  const endScrub = (clientX) => {
    if (!scrubbingRef.current) return;
    const video = videoRef?.current;
    const next = valueFromClientX(clientX);
    scrubbingRef.current = false;
    setDragging(false);
    onScrubbingChange?.(false);
    if (video && Number.isFinite(next)) {
      try {
        video.currentTime = next;
      } catch {
        // ignore
      }
      setCurrent(next);
    }
  };

  const displayTime = dragging ? dragValue : current;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, Math.max(0, (bufferedEnd / duration) * 100)) : 0;

  return (
    <div
      className="watch-seek-zone"
      onClick={(event) => event.stopPropagation()}
    >
      <div className={`watch-seek ${dragging ? 'is-dragging' : ''}`}>
        <div className={`watch-seek-times ${dragging ? 'is-prominent' : ''}`}>
          <span>{formatClock(displayTime)}</span>
          <span>{formatClock(duration)}</span>
        </div>
        <div
          ref={trackRef}
          className="watch-seek-hit"
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration) || 0}
          aria-valuenow={Math.floor(displayTime) || 0}
          aria-label="Seek"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            beginScrub(event.clientX);
          }}
          onPointerMove={(event) => {
            if (!scrubbingRef.current) return;
            event.stopPropagation();
            moveScrub(event.clientX);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            endScrub(event.clientX);
          }}
          onPointerCancel={(event) => {
            event.stopPropagation();
            scrubbingRef.current = false;
            setDragging(false);
            onScrubbingChange?.(false);
          }}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            const video = videoRef?.current;
            if (!video || !duration) return;
            const step = Math.max(1, duration * 0.05);
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              video.currentTime = Math.min(duration, (video.currentTime || 0) + step);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              video.currentTime = Math.max(0, (video.currentTime || 0) - step);
            }
          }}
        >
          <div className="watch-seek-track">
            <div className="watch-seek-buffered" style={{ width: `${bufferedPct}%` }} />
            <div className="watch-seek-played" style={{ width: `${pct}%` }} />
            <div className="watch-seek-thumb" style={{ left: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
