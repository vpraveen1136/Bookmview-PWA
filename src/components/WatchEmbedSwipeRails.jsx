import { useVerticalSwipe } from '../hooks/useVerticalSwipe.js';

/**
 * Swipe targets for cross-origin iframe embeds (touches do not bubble to the parent).
 * - bottom: full-width lower band (used with shortened iframe layout)
 * - edges: left/right rails over a full-height iframe
 */
export function WatchEmbedSwipeRails({
  variant = 'edges',
  enabled = true,
  onSwipeUp,
  onSwipeDown,
}) {
  const swipe = useVerticalSwipe({
    enabled,
    onSwipeUp,
    onSwipeDown,
  });

  if (variant === 'bottom') {
    return (
      <div
        className="watch-embed-swipe-rail watch-embed-swipe-rail-bottom"
        aria-hidden="true"
        {...swipe}
      />
    );
  }

  return (
    <div className="watch-embed-swipe-rails" aria-hidden="true">
      <div className="watch-embed-swipe-rail watch-embed-swipe-rail-left" {...swipe} />
      <div className="watch-embed-swipe-rail watch-embed-swipe-rail-right" {...swipe} />
    </div>
  );
}
