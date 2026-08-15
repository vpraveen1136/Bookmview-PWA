import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { scrollPreviewPrefetch } from '../lib/scrollPreviewPrefetch.js';
import { getScrollPreviewViewport, subscribeScroll } from '../lib/pageScroll.js';

const ScrollPreviewContext = createContext(null);

const MIN_VISIBLE_FRACTION = 0.2;

function pickCenterId(entries) {
  const { top: viewportTop, bottom: viewportBottom, center: viewportCenter } = getScrollPreviewViewport();
  let bestId = null;
  let bestDistance = Infinity;

  entries.forEach((meta, id) => {
    const { element } = meta;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const visibleTop = Math.max(rect.top, viewportTop);
    const visibleBottom = Math.min(rect.bottom, viewportBottom);
    const visibleHeight = visibleBottom - visibleTop;
    if (visibleHeight <= 0 || visibleHeight < rect.height * MIN_VISIBLE_FRACTION) return;

    const cardCenter = rect.top + rect.height / 2;
    const distance = Math.abs(cardCenter - viewportCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = id;
    }
  });

  return bestId;
}

export function ScrollPreviewProvider({ children, enabled = true }) {
  const entriesRef = useRef(new Map());
  const activeIdRef = useRef(null);
  const listenersRef = useRef(new Map());
  const rafRef = useRef(null);

  const notify = useCallback((id) => {
    listenersRef.current.forEach((listener, listenerId) => {
      listener(id === listenerId);
    });
  }, []);

  const pickActive = useCallback(() => {
    if (!enabled) return;

    const bestId = pickCenterId(entriesRef.current);
    if (activeIdRef.current === bestId) return;

    activeIdRef.current = bestId;
    if (bestId) scrollPreviewPrefetch.prioritize(bestId);
    notify(bestId);
  }, [enabled, notify]);

  const schedulePick = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      pickActive();
    });
  }, [pickActive]);

  useEffect(() => {
    if (!enabled) {
      activeIdRef.current = null;
      notify(null);
      return undefined;
    }

    schedulePick();

    const unsubScroll = subscribeScroll(schedulePick);
    const onViewportChange = () => schedulePick();
    window.addEventListener('resize', onViewportChange, { passive: true });

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onViewportChange);
      vv.addEventListener('scroll', onViewportChange);
    }

    return () => {
      unsubScroll();
      window.removeEventListener('resize', onViewportChange);
      if (vv) {
        vv.removeEventListener('resize', onViewportChange);
        vv.removeEventListener('scroll', onViewportChange);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, schedulePick]);

  const register = useCallback((id, element) => {
    if (element) {
      entriesRef.current.set(id, { element });
      schedulePick();
      return;
    }

    entriesRef.current.delete(id);
    if (activeIdRef.current === id) {
      activeIdRef.current = null;
      notify(null);
    }
    schedulePick();
  }, [notify, schedulePick]);

  const subscribe = useCallback((id, listener) => {
    listenersRef.current.set(id, listener);
    listener(activeIdRef.current === id);
    return () => listenersRef.current.delete(id);
  }, []);

  const value = useMemo(() => ({
    enabled,
    register,
    subscribe,
  }), [enabled, register, subscribe]);

  return (
    <ScrollPreviewContext.Provider value={value}>
      {children}
    </ScrollPreviewContext.Provider>
  );
}

export function useScrollPreviewRegistration(id) {
  const ctx = useContext(ScrollPreviewContext);
  const idRef = useRef(id);
  idRef.current = id;

  const setRef = useCallback((element) => {
    if (!ctx?.enabled || !idRef.current) return;
    ctx.register(idRef.current, element);
  }, [ctx]);

  useEffect(() => {
    if (!ctx?.enabled || !id) return undefined;
    return () => ctx.register(id, null);
  }, [ctx, id]);

  return setRef;
}

export function useScrollPreviewActive(id) {
  const ctx = useContext(ScrollPreviewContext);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!ctx?.enabled || !id) {
      setActive(false);
      return undefined;
    }
    return ctx.subscribe(id, setActive);
  }, [ctx, id]);

  return active;
}
