import { useMemo } from 'react';



import { getEffectivePlaybackMode, isLocalProxyUrl, PLAYBACK_MODES, resolvePlaybackForMode } from '../lib/playbackModes.js';

import { VideoSurface } from './VideoSurface.jsx';



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

}) {

  const previewPlayback = useMemo(

    () => resolvePlaybackForMode(bookmark, getEffectivePlaybackMode(bookmark), ''),

    [bookmark],

  );

  const activePlayback = playback || previewPlayback;

  const proxyOnly = activePlayback?.url && isLocalProxyUrl(activePlayback.url);



  const qualityVariants = playbackState?.qualityVariants || playbackState?.variants || [];

  const showQualityPicker = isActive

    && playbackState

    && playbackState.mode !== PLAYBACK_MODES.HLS

    && qualityVariants.length > 0;



  const qualityProps = showQualityPicker ? {

    variants: qualityVariants,

    value: playbackState.variantUrl,

    defaultUrl: playbackState.defaultVariantUrl,

    onChange: playbackState.setVariantUrl,

    formatLabel: playbackState.formatVariantOptionLabel,

  } : null;



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

