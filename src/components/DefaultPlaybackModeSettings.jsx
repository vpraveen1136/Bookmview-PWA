import { useEffect, useState } from 'react';

import {
  getStoredPlaybackMode,
  PLAYBACK_MODE_OPTIONS,
  setStoredPlaybackMode,
} from '../lib/playbackModes.js';

/**
 * App-level default playback mode (Stream chunks / Direct CDN / Full file / HLS).
 */
export function DefaultPlaybackModeSettings({ compact = false }) {
  const [mode, setMode] = useState(() => getStoredPlaybackMode());

  useEffect(() => {
    setMode(getStoredPlaybackMode());
  }, []);

  const onChange = (next) => {
    setStoredPlaybackMode(next);
    setMode(next);
  };

  return (
    <section className={compact ? 'settings-block settings-block-compact' : 'settings-block'}>
      <h3 className="settings-block-title">Default playback mode</h3>
      <p className="settings-block-hint">
        Used on watch when the video supports it. Falls back if a mode has no URL.
      </p>
      <div className="pill-row">
        {PLAYBACK_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`pill ${mode === opt.id ? 'pill-active' : ''}`}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
