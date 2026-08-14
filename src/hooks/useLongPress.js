import { useCallback, useRef } from 'react';

const DEFAULT_DELAY_MS = 520;

export function useLongPress({ onLongPress, delay = DEFAULT_DELAY_MS, disabled = false } = {}) {
  const timerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback((event) => {
    if (disabled) return;
    longPressTriggeredRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress?.(event);
    }, delay);
  }, [clearTimer, delay, disabled, onLongPress]);

  const cancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onClickCapture = useCallback((event) => {
    if (longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onContextMenu: (event) => {
      if (disabled) return;
      event.preventDefault();
      onLongPress?.(event);
    },
    onClickCapture,
  };
}
