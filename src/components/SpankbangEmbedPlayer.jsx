import { useCallback, useEffect, useState } from 'react';

import { getBookmarkPageUrl } from '../lib/playback.js';
import {
  resolveSpankbangEmbedUrl,
  resolveSpankbangVideoPageUrl,
} from '../lib/spankbangEmbed.js';
import { WatchEmbedSwipeRails } from './WatchEmbedSwipeRails.jsx';

const LOAD_TIMEOUT_MS = 20000;

export function SpankbangEmbedPlayer({
  bookmark,
  embedUrl: embedUrlProp,
  className = '',
  isActive = true,
  chromeVisible = false,
  showTitle = false,
  titleMeta = null,
  swipeEnabled = true,
  onSwipeUp,
  onSwipeDown,
}) {
  const embedUrl = embedUrlProp || resolveSpankbangEmbedUrl(bookmark);
  const [loadState, setLoadState] = useState('loading');
  const [retryKey, setRetryKey] = useState(0);

  const resetLoad = useCallback(() => {
    setLoadState('loading');
  }, []);

  useEffect(() => {
    resetLoad();
  }, [embedUrl, retryKey, resetLoad]);

  useEffect(() => {
    if (!isActive || !embedUrl || loadState !== 'loading') return undefined;
    const timer = window.setTimeout(() => {
      setLoadState('error');
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [embedUrl, isActive, loadState, retryKey]);

  const onIframeLoad = () => {
    setLoadState('ready');
  };

  const pageUrl = getBookmarkPageUrl(bookmark) || resolveSpankbangVideoPageUrl(bookmark);

  const controlsShown = Boolean(chromeVisible);
  const showSwipeZone = isActive && onSwipeUp && onSwipeDown;

  if (!embedUrl) {
    return (
      <div className={`spankbang-embed-player ${className}`}>
        <div className="playback-error playback-error-compact" role="alert">
          <p className="playback-error-title">Unable to load SpankBang player</p>
          <p className="playback-error-hint">
            No SpankBang video id found for this bookmark.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`spankbang-embed-player spankbang-embed-player-short ${controlsShown ? 'chrome-visible' : ''} ${className}`}>
      <div className="spankbang-embed-player-frame-wrap">
        {isActive ? (
          <iframe
            key={`${embedUrl}:${retryKey}`}
            className="spankbang-embed-player-frame"
            src={embedUrl}
            title={titleMeta?.title || 'SpankBang video'}
            frameBorder="0"
            scrolling="no"
            width="100%"
            height="100%"
            allow="autoplay; fullscreen"
            allowFullScreen
            onLoad={onIframeLoad}
          />
        ) : null}

        {isActive && controlsShown && showTitle && titleMeta ? (
          <div className="watch-title-banner watch-chrome-fade is-visible" onClick={(e) => e.stopPropagation()}>
            <span className="watch-source-pill">{titleMeta.source}</span>
            <p className="watch-title-overlay">{titleMeta.title}</p>
          </div>
        ) : null}

        {loadState === 'loading' && isActive ? (
          <div className="spankbang-embed-player-status" role="status">
            Loading SpankBang player…
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="spankbang-embed-player-error" role="alert">
            <p className="playback-error-title">Unable to load SpankBang player</p>
            <div className="spankbang-embed-player-error-actions">
              <button
                type="button"
                className="btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setRetryKey((k) => k + 1);
                }}
              >
                Retry
              </button>
              {pageUrl ? (
                <a
                  className="btn"
                  href={pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  Open Source
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {showSwipeZone ? (
        <WatchEmbedSwipeRails
          variant="bottom"
          enabled={swipeEnabled}
          onSwipeUp={onSwipeUp}
          onSwipeDown={onSwipeDown}
        />
      ) : (
        <div className="spankbang-embed-player-swipe-spacer" aria-hidden="true" />
      )}
    </div>
  );
}
