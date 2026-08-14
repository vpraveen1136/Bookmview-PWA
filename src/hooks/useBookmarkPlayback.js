import { useEffect, useMemo, useState } from 'react';

import { getDurationMs } from '../lib/libraryFilters.js';
import {
  formatVariantOptionLabel,
  getEffectivePlaybackMode,
  getProgressiveVariants,
  getVariantsForMode,
  listAvailablePlaybackModes,
  pickDefaultVariantUrl,
  PLAYBACK_MODES,
  resolvePlaybackAlternates,
  resolvePlaybackForMode,
  setStoredPlaybackMode,
} from '../lib/playbackModes.js';

/** Resolves playback mode/variant/source for one bookmark (shared by watch item + sheet). */
export function useBookmarkPlayback(bookmark) {
  const availableModes = useMemo(
    () => (bookmark ? listAvailablePlaybackModes(bookmark) : []),
    [bookmark],
  );

  const [mode, setMode] = useState(() => getEffectivePlaybackMode(null));
  const [variantUrl, setVariantUrl] = useState('');

  useEffect(() => {
    setVariantUrl('');
  }, [bookmark?.tweet_id]);

  useEffect(() => {
    if (!bookmark) return;
    setVariantUrl('');
    const available = availableModes.map((item) => item.id);
    setMode(getEffectivePlaybackMode(bookmark, available));
  }, [availableModes, bookmark]);

  const variants = useMemo(
    () => (mode === PLAYBACK_MODES.HLS ? [] : getVariantsForMode(bookmark, mode)),
    [bookmark, mode],
  );

  /** All progressive MP4 qualities — used by the on-screen picker (not mode-filtered). */
  const qualityVariants = useMemo(
    () => (bookmark ? getProgressiveVariants(bookmark) : []),
    [bookmark],
  );

  const defaultVariantUrl = useMemo(
    () => pickDefaultVariantUrl(bookmark, mode, getDurationMs(bookmark)),
    [bookmark, mode],
  );

  const playback = useMemo(() => {
    if (!bookmark) return null;
    const primary = resolvePlaybackForMode(bookmark, mode, variantUrl);
    const alternates = resolvePlaybackAlternates(bookmark, mode);
    if (primary?.url) return { ...primary, alternates };

    for (const item of availableModes) {
      if (item.id === mode) continue;
      const alt = resolvePlaybackForMode(bookmark, item.id, '');
      if (alt?.url) {
        return {
          ...alt,
          alternates: resolvePlaybackAlternates(bookmark, item.id),
        };
      }
    }
    return null;
  }, [availableModes, bookmark, mode, variantUrl]);

  const onModeChange = (nextMode) => {
    setMode(nextMode);
    setStoredPlaybackMode(nextMode);
    setVariantUrl('');
  };

  return {
    availableModes,
    mode,
    onModeChange,
    variants,
    qualityVariants,
    defaultVariantUrl,
    variantUrl,
    setVariantUrl,
    playback,
    formatVariantOptionLabel: (variant) => formatVariantOptionLabel(variant, bookmark, mode),
  };
}
