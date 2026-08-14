import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import {
  getScrollObservationTarget,
  readScrollOffset,
  restoreScrollTop,
  scrollStorageKey,
  subscribeScroll,
} from '../lib/pageScroll.js';

/**
 * Keeps dashboard / library scroll position across watch navigation.
 * Lives in ReadyShell so scroll is saved before route children unmount.
 */
export function TabScrollRestoration() {
  const location = useLocation();
  const storageKey = scrollStorageKey(location.pathname, location.search);
  const scrollTopRef = useRef(0);
  const prevKeyRef = useRef(null);

  useLayoutEffect(() => {
    const leavingKey = prevKeyRef.current;
    if (leavingKey) {
      const top = scrollTopRef.current || readScrollOffset().top;
      sessionStorage.setItem(leavingKey, String(top));
    }

    prevKeyRef.current = storageKey;

    if (!storageKey) return;

    const saved = Number(sessionStorage.getItem(storageKey) || '0');
    if (saved > 0) {
      restoreScrollTop(saved);
    }
  }, [storageKey, location.key]);

  useEffect(() => {
    if (!storageKey) return undefined;

    const sync = () => {
      scrollTopRef.current = readScrollOffset().top;
      sessionStorage.setItem(storageKey, String(scrollTopRef.current));
    };

    const unsubscribe = subscribeScroll(sync);
    return () => {
      unsubscribe();
      sessionStorage.setItem(storageKey, String(scrollTopRef.current || readScrollOffset().top));
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return undefined;

    const saved = Number(sessionStorage.getItem(storageKey) || '0');
    if (!saved) return undefined;

    const retry = window.setTimeout(() => restoreScrollTop(saved), 120);
    const root = getScrollObservationTarget();
    if (!root) {
      return () => window.clearTimeout(retry);
    }

    const ro = new ResizeObserver(() => restoreScrollTop(saved));
    ro.observe(root);
    return () => {
      window.clearTimeout(retry);
      ro.disconnect();
    };
  }, [storageKey, location.key]);

  return null;
}
