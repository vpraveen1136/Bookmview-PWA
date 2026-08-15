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
import { SCROLL_PREVIEW_ACTIVATION_RATIO } from '../lib/scrollPreview.js';
import {
  getScrollPreviewViewport,
  getScrollObservationTarget,
  isElementCompletelyOutsideScrollPreviewViewport,
  getElementIntersectionRatioInScrollPreviewViewport,
  subscribeScroll,
} from '../lib/pageScroll.js';

const ScrollPreviewContext = createContext(null);

const IO_THRESHOLDS = [0, 0.05, 0.08, 0.1, 0.25, 0.5, 1];

function updateEntryGeometry(meta) {
  if (!meta?.element) return;
  meta.completelyOutside = isElementCompletelyOutsideScrollPreviewViewport(meta.element);
  meta.intersectionRatio = getElementIntersectionRatioInScrollPreviewViewport(meta.element);
  meta.overlaps = !meta.completelyOutside;
}

function pickBestOverlappingId(entries) {
  const { center: viewportCenter } = getScrollPreviewViewport();
  let bestId = null;
  let bestDistance = Infinity;

  entries.forEach((meta, id) => {
    if (!meta.element || meta.completelyOutside || !meta.overlaps) return;

    const ratio = meta.intersectionRatio ?? 0;
    if (ratio < SCROLL_PREVIEW_ACTIVATION_RATIO) return;

    const rect = meta.element.getBoundingClientRect();
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
  const listenersRef = useRef(new Map());
  const activeIdRef = useRef(null);
  const observerRef = useRef(null);
  const rafRef = useRef(null);

  const notifyAll = useCallback(() => {
    const activeId = activeIdRef.current;
    listenersRef.current.forEach((listener, id) => {
      listener(id === activeId);
    });
  }, []);

  const setActiveId = useCallback((nextId) => {
    const id = nextId ? String(nextId) : null;
    if (activeIdRef.current === id) return;

    activeIdRef.current = id;
    if (id) scrollPreviewPrefetch.setActiveId(id);
    notifyAll();
  }, [notifyAll]);

  const reconcileActive = useCallback(() => {
    if (!enabled) return;

    entriesRef.current.forEach((meta) => updateEntryGeometry(meta));

    const currentActive = activeIdRef.current;
    if (currentActive) {
      const activeMeta = entriesRef.current.get(currentActive);
      if (!activeMeta?.element || activeMeta.completelyOutside) {
        setActiveId(null);
      } else {
        // Retain ownership while any part of the card remains in the viewport.
        return;
      }
    }

    const bestId = pickBestOverlappingId(entriesRef.current);
    if (bestId) {
      setActiveId(bestId);
    }
  }, [enabled, setActiveId]);

  const scheduleReconcile = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      reconcileActive();
    });
  }, [reconcileActive]);

  useEffect(() => {
    if (!enabled) {
      activeIdRef.current = null;
      listenersRef.current.forEach((listener) => listener(false));
      return undefined;
    }

    const root = getScrollObservationTarget();
    const observer = new IntersectionObserver(
      (observed) => {
        for (const entry of observed) {
          const id = entry.target.dataset.scrollPreviewId;
          if (!id) continue;
          const meta = entriesRef.current.get(id) || { element: entry.target };
          meta.element = entry.target;
          meta.ioRatio = entry.intersectionRatio;
          entriesRef.current.set(id, meta);
        }
        scheduleReconcile();
      },
      {
        root: root === document.documentElement ? null : root,
        threshold: IO_THRESHOLDS,
      },
    );
    observerRef.current = observer;

    entriesRef.current.forEach((meta) => {
      if (meta?.element) observer.observe(meta.element);
    });

    scheduleReconcile();

    const unsubScroll = subscribeScroll(scheduleReconcile);
    const onViewportChange = () => scheduleReconcile();
    window.addEventListener('resize', onViewportChange, { passive: true });

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onViewportChange);
      vv.addEventListener('scroll', onViewportChange);
    }

    return () => {
      unsubScroll();
      observer.disconnect();
      observerRef.current = null;
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
  }, [enabled, scheduleReconcile]);

  const register = useCallback((id, element) => {
    const observer = observerRef.current;
    const prev = entriesRef.current.get(id);

    if (prev?.element && observer) {
      observer.unobserve(prev.element);
    }

    if (element) {
      element.dataset.scrollPreviewId = id;
      const meta = { element, completelyOutside: true, overlaps: false, intersectionRatio: 0 };
      entriesRef.current.set(id, meta);
      updateEntryGeometry(meta);
      if (observer) observer.observe(element);
      scheduleReconcile();
      return;
    }

    entriesRef.current.delete(id);
    if (activeIdRef.current === id) {
      setActiveId(null);
    }
    scheduleReconcile();
  }, [scheduleReconcile, setActiveId]);

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

/** True only for the single active preview card (plays until completely outside or replaced). */
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
