import { useVerticalSwipe } from '../hooks/useVerticalSwipe.js';

/**
 * Edge swipe targets for cross-origin iframe embeds (touches do not bubble to the parent).
 * Left/right rails capture vertical swipes; center remains interactive with the iframe.
 */
export function WatchEmbedSwipeRails({
  enabled = true,
  onSwipeUp,
  onSwipeDown,
}) {
  const swipe = useVerticalSwipe({
    enabled,
    onSwipeUp,
    onSwipeDown,
  });

  return (
    <div className="watch-embed-swipe-rails" aria-hidden="true">
      <div className="watch-embed-swipe-rail watch-embed-swipe-rail-left" {...swipe} />
      <div className="watch-embed-swipe-rail watch-embed-swipe-rail-right" {...swipe} />
    </div>
  );
}
