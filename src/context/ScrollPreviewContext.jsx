import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getScrollObservationTarget, subscribeScroll } from '../lib/pageScroll.js';

const ScrollPreviewContext = createContext(null);

const MIN_VISIBLE_RATIO = 0.3;

function pickCenterId(entries) {
  const viewportCenter = window.innerHeight / 2;
  let bestId = null;
  let bestDistance = Infinity;

  entries.forEach((meta, id) => {
    const { element, ratio } = meta;
    if (!element || ratio < MIN_VISIBLE_RATIO) return;

    const rect = element.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;

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
  const observerRef = useRef(null);
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

    const root = getScrollObservationTarget();
    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          const id = entry.target.dataset.scrollPreviewId;
          if (!id) continue;
          const prev = entriesRef.current.get(id) || { element: entry.target };
          prev.ratio = entry.intersectionRatio;
          prev.element = entry.target;
          entriesRef.current.set(id, prev);
        }
        schedulePick();
      },
      {
        root: root === document.documentElement ? null : root,
        threshold: [0, 0.15, 0.3, 0.5, 0.75, 1],
      },
    );

    observerRef.current = observer;

    entriesRef.current.forEach((meta) => {
      if (meta?.element) observer.observe(meta.element);
    });

    schedulePick();

    const unsubScroll = subscribeScroll(schedulePick);

    return () => {
      unsubScroll();
      observer.disconnect();
      observerRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, schedulePick]);

  const register = useCallback((id, element) => {
    const observer = observerRef.current;
    const prev = entriesRef.current.get(id);

    if (prev?.element && observer) {
      observer.unobserve(prev.element);
    }

    if (element) {
      element.dataset.scrollPreviewId = id;
      entriesRef.current.set(id, { element, ratio: 0 });
      if (observer) observer.observe(element);
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
