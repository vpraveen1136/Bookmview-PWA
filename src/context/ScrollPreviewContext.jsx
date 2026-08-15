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
import {
  isElementFullyInScrollPreviewViewport,
  subscribeScroll,
} from '../lib/pageScroll.js';

const ScrollPreviewContext = createContext(null);

export function ScrollPreviewProvider({ children, enabled = true }) {
  const entriesRef = useRef(new Map());
  const listenersRef = useRef(new Map());
  const rafRef = useRef(null);

  const notifyVisibility = useCallback((id, fullyVisible) => {
    const listener = listenersRef.current.get(id);
    if (listener) listener(fullyVisible);
  }, []);

  const measureAll = useCallback(() => {
    if (!enabled) return;

    entriesRef.current.forEach((meta, id) => {
      const element = meta.element;
      if (!element) return;

      const fullyVisible = isElementFullyInScrollPreviewViewport(element);
      if (meta.fullyVisible === fullyVisible) return;

      meta.fullyVisible = fullyVisible;
      if (fullyVisible && !scrollPreviewPrefetch.getClip(id)?.ready) {
        scrollPreviewPrefetch.prioritize(id);
      }
      notifyVisibility(id, fullyVisible);
    });
  }, [enabled, notifyVisibility]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measureAll();
    });
  }, [measureAll]);

  useEffect(() => {
    if (!enabled) {
      listenersRef.current.forEach((listener) => listener(false));
      return undefined;
    }

    scheduleMeasure();

    const unsubScroll = subscribeScroll(scheduleMeasure);
    const onViewportChange = () => scheduleMeasure();
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
  }, [enabled, scheduleMeasure]);

  const register = useCallback((id, element) => {
    if (element) {
      const fullyVisible = isElementFullyInScrollPreviewViewport(element);
      entriesRef.current.set(id, { element, fullyVisible });
      if (fullyVisible && !scrollPreviewPrefetch.getClip(id)?.ready) {
        scrollPreviewPrefetch.prioritize(id);
      }
      notifyVisibility(id, fullyVisible);
      scheduleMeasure();
      return;
    }

    entriesRef.current.delete(id);
    notifyVisibility(id, false);
    scheduleMeasure();
  }, [notifyVisibility, scheduleMeasure]);

  const subscribe = useCallback((id, listener) => {
    listenersRef.current.set(id, listener);
    const meta = entriesRef.current.get(id);
    listener(meta?.fullyVisible ?? false);
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

/** True while the bookmark thumb is fully inside the visible viewport. */
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
