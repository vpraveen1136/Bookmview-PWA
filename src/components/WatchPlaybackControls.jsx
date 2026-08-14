import { useEffect } from 'react';

import { useBookmarkPlayback } from '../hooks/useBookmarkPlayback.js';
import { isLocalProxyUrl } from '../lib/playbackModes.js';
import { PLAYBACK_MODES } from '../lib/playbackModes.js';

export function WatchPlaybackControls({
  bookmark,
  onSourceChange,
  variant = 'inline',
  playbackState: externalState,
}) {
  const internalState = useBookmarkPlayback(bookmark);
  const state = externalState || internalState;
  const {
    availableModes,
    mode,
    onModeChange,
    playback,
  } = state;

  useEffect(() => {
    onSourceChange?.(playback, {
      mode,
      needsDesktopProxy: playback?.url ? isLocalProxyUrl(playback.url) : false,
    });
  }, [onSourceChange, playback, mode]);

  if (!bookmark || !availableModes.length) {
    return (
      <p className="watch-playback-note">
        No progressive or HLS URLs in this row. Re-export <code>bookmview.db</code> after refreshing on desktop.
      </p>
    );
  }

  const rootClass = variant === 'sheet'
    ? 'watch-playback-controls watch-playback-sheet'
    : 'watch-playback-controls';

  return (
    <div className={rootClass}>
      <label className="watch-control-label" htmlFor="watch-playback-mode">
        Playback
      </label>
      <select
        id="watch-playback-mode"
        className="select-control watch-select"
        value={mode}
        onChange={(event) => onModeChange(event.target.value)}
      >
        {availableModes.map((item) => (
          <option key={item.id} value={item.id}>{item.label}</option>
        ))}
      </select>

      {variant !== 'sheet' ? (
        <>
          {mode === PLAYBACK_MODES.STREAM ? (
            <p className="watch-playback-note">
              X: direct MP4 (no referer). SpankBang may use the in-app proxy when needed.
            </p>
          ) : null}
          {mode === PLAYBACK_MODES.HLS ? (
            <p className="watch-playback-note">
              HLS uses the saved manifest. If it fails, try another mode or refresh on desktop.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
