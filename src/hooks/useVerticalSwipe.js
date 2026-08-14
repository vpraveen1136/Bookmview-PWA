import { useRef } from 'react';

const MIN_SWIPE_PX = 56;
const MAX_SWIPE_MS = 500;
const MAX_HORIZONTAL_DRIFT = 48;

function isInteractiveTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  return Boolean(target.closest(
    'button, a, input, select, textarea, label, .sheet-root, .watch-drawer, .watch-drawer-backdrop, .watch-quality, .watch-speed, .watch-seek-hit, .watch-center-play, .watch-title-toggle, .watch-top-more, .watch-toolbar-btn, .watch-toolbar-zone, .watch-picker-menu',
  ));
}

export function useVerticalSwipe({
  onSwipeUp,
  onSwipeDown,
  enabled = true,
  onDrag,
  onDragEnd,
}) {
  const touchRef = useRef({ y: 0, x: 0, t: 0, active: false });

  const onTouchStart = (event) => {
    if (!enabled || isInteractiveTarget(event.target)) return;
    const touch = event.changedTouches[0];
    touchRef.current = {
      y: touch.clientY,
      x: touch.clientX,
      t: Date.now(),
      active: true,
    };
  };

  const onTouchMove = (event) => {
    if (!enabled || !touchRef.current.active) return;
    const touch = event.changedTouches[0];
    const deltaY = touch.clientY - touchRef.current.y;
    const deltaX = touch.clientX - touchRef.current.x;
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;
    onDrag?.(deltaY);
  };

  const onTouchEnd = (event) => {
    if (!enabled || !touchRef.current.active) return;
    touchRef.current.active = false;
    const touch = event.changedTouches[0];
    const deltaY = touch.clientY - touchRef.current.y;
    const deltaX = touch.clientX - touchRef.current.x;
    const elapsed = Date.now() - touchRef.current.t;
    onDragEnd?.();

    if (Math.abs(deltaX) > MAX_HORIZONTAL_DRIFT) return;
    if (elapsed > MAX_SWIPE_MS) return;
    if (Math.abs(deltaY) < MIN_SWIPE_PX) return;

    if (deltaY < 0) onSwipeUp?.();
    else onSwipeDown?.();
  };

  const onWheel = (event) => {
    if (!enabled || isInteractiveTarget(event.target)) return;
    if (Math.abs(event.deltaY) < 40) return;
    if (event.deltaY > 0) onSwipeUp?.();
    else onSwipeDown?.();
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
  };
}
