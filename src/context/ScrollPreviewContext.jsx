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
import { logScrollPreviewState } from '../lib/scrollPreviewDebug.js';
import { SCROLL_PREVIEW_ACTIVATION_RATIO } from '../lib/scrollPreview.js';
import {
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

function isOverlapping(meta) {
  return Boolean(meta?.element && !meta.completelyOutside && meta.overlaps);
}

function isActivatable(meta) {
  if (!isOverlapping(meta)) return false;
  return (meta.intersectionRatio ?? 0) >= SCROLL_PREVIEW_ACTIVATION_RATIO;
}

/**
 * Pick the next active card by playable queue order — not viewport centre.
 * After handoff, any overlap counts; initial pick uses the ~8% entry threshold.
 */
function pickNextActiveId(entries, exitedActiveId = null) {
  const orderIds = scrollPreviewPrefetch.getOrderIds();
  if (!orderIds.length) return null;

  const exitedIdx = exitedActiveId ? orderIds.indexOf(exitedActiveId) : -1;

  if (exitedIdx >= 0) {
    for (let i = exitedIdx + 1; i < orderIds.length; i += 1) {
      const meta = entries.get(orderIds[i]);
      if (isOverlapping(meta)) return orderIds[i];
    }
    for (let i = exitedIdx - 1; i >= 0; i -= 1) {
      const meta = entries.get(orderIds[i]);
      if (isOverlapping(meta)) return orderIds[i];
    }
    return null;
  }

  for (const id of orderIds) {
    if (isActivatable(entries.get(id))) return id;
  }

  for (const id of orderIds) {
    if (isOverlapping(entries.get(id))) return id;
  }

  return null;
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

  const applyActiveId = useCallback((nextId) => {
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
        const exitedId = currentActive;
        activeIdRef.current = null;
        const nextId = pickNextActiveId(entriesRef.current, exitedId);
        if (nextId) {
          activeIdRef.current = nextId;
          scrollPreviewPrefetch.setActiveId(nextId);
        }
        notifyAll();
        logScrollPreviewState({
          activeId: activeIdRef.current,
          entries: entriesRef.current,
          exitedId,
          pickedId: nextId,
        });
        return;
      }

      logScrollPreviewState({
        activeId: currentActive,
        entries: entriesRef.current,
      });
      return;
    }

    const nextId = pickNextActiveId(entriesRef.current, null);
    if (nextId) {
      applyActiveId(nextId);
    }
    logScrollPreviewState({
      activeId: activeIdRef.current,
      entries: entriesRef.current,
      pickedId: nextId,
    });
  }, [enabled, applyActiveId, notifyAll]);

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
          meta.isIntersecting = entry.isIntersecting;
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
      const exitedId = id;
      activeIdRef.current = null;
      const nextId = pickNextActiveId(entriesRef.current, exitedId);
      if (nextId) {
        activeIdRef.current = nextId;
        scrollPreviewPrefetch.setActiveId(nextId);
      }
      notifyAll();
    }
    scheduleReconcile();
  }, [scheduleReconcile, notifyAll]);

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

/** True only for the single active preview card (plays until completely outside). */
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
