import { useMemo } from 'react';

import { getEffectivePlaybackMode, isLocalProxyUrl, PLAYBACK_MODES, resolvePlaybackForMode } from '../lib/playbackModes.js';
import {
  canUseSpankbangEmbedPlayback,
  isSpankbangIframeEligible,
  resolveSpankbangEmbedUrl,
} from '../lib/spankbangEmbed.js';

import { SpankbangEmbedPlayer } from './SpankbangEmbedPlayer.jsx';
import { VideoSurface } from './VideoSurface.jsx';
import { WatchEmbedSwipeRails } from './WatchEmbedSwipeRails.jsx';

export function WatchFeedItem({
  bookmark,
  playback,
  playbackState,
  isActive,
  showControls,
  titleVisible,
  titleMeta,
  onError,
  onScrubbingChange,
  seekApiRef,
  swipeEnabled = true,
  onSwipeUp,
  onSwipeDown,
}) {
  const useSpankbangEmbed = canUseSpankbangEmbedPlayback(bookmark);
  const spankbangEmbedUrl = useMemo(
    () => (useSpankbangEmbed ? resolveSpankbangEmbedUrl(bookmark) : null),
    [bookmark, useSpankbangEmbed],
  );

  const previewPlayback = useMemo(
    () => resolvePlaybackForMode(bookmark, getEffectivePlaybackMode(bookmark), ''),
    [bookmark],
  );

  const activePlayback = playback || previewPlayback;
  const proxyOnly = activePlayback?.url && isLocalProxyUrl(activePlayback.url);

  const qualityVariants = playbackState?.qualityVariants || playbackState?.variants || [];
  const showQualityPicker = isActive
    && playbackState
    && !useSpankbangEmbed
    && playbackState.mode !== PLAYBACK_MODES.HLS
    && qualityVariants.length > 0;

  const qualityProps = showQualityPicker ? {
    variants: qualityVariants,
    value: playbackState.variantUrl,
    defaultUrl: playbackState.defaultVariantUrl,
    onChange: playbackState.setVariantUrl,
    formatLabel: playbackState.formatVariantOptionLabel,
  } : null;

  if (useSpankbangEmbed) {
    if (!isSpankbangIframeEligible(bookmark) || !spankbangEmbedUrl) {
      return (
        <div className={`watch-slot ${isActive ? 'watch-slot-active' : ''}`}>
          <div className="watch-slot-media">
            <div className="playback-error playback-error-compact" role="alert">
              <p className="playback-error-title">No playable URL</p>
              <p className="playback-error-hint">
                This SpankBang bookmark has no resolvable video id (playlist wrapper only).
                Open the source on desktop to resolve, or pick another video.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`watch-slot ${isActive ? 'watch-slot-active' : ''}`}>
        <div className="watch-slot-media">
          <SpankbangEmbedPlayer
            bookmark={bookmark}
            embedUrl={spankbangEmbedUrl}
            className="watch-feed-video"
            isActive={isActive}
            chromeVisible={showControls}
            showTitle={titleVisible}
            titleMeta={titleMeta}
            swipeRails={
              isActive && onSwipeUp && onSwipeDown ? (
                <WatchEmbedSwipeRails
                  enabled={swipeEnabled}
                  onSwipeUp={onSwipeUp}
                  onSwipeDown={onSwipeDown}
                />
              ) : null
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`watch-slot ${isActive ? 'watch-slot-active' : ''}`}>
      <div className="watch-slot-media">
        {proxyOnly ? (
          <div className="playback-error playback-error-compact" role="alert">
            <p className="playback-error-title">Desktop proxy URL</p>
            <p className="playback-error-hint">
              Re-export the database after choosing Direct CDN on desktop.
            </p>
          </div>
        ) : activePlayback ? (
          <VideoSurface
            source={activePlayback}
            className="watch-feed-video"
            isActive={isActive}
            chromeVisible={showControls}
            showTitle={titleVisible}
            titleMeta={titleMeta}
            tweetId={bookmark.tweet_id}
            posterUrl={null}
            onError={onError}
            onScrubbingChange={onScrubbingChange}
            seekApiRef={seekApiRef}
            qualityProps={qualityProps}
          />
        ) : (
          <div className="playback-error playback-error-compact" role="alert">
            <p className="playback-error-title">No playable URL</p>
            <p className="playback-error-hint">Refresh on desktop and re-export the database.</p>
          </div>
        )}
      </div>
    </div>
  );
}
