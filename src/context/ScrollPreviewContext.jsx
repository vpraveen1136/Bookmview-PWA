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
import {
  isVideoCenterInFocusBand,
  readScrollOffset,
  subscribeScroll,
} from '../lib/pageScroll.js';

const ScrollPreviewContext = createContext(null);

function updateEntryGeometry(meta) {
  if (!meta?.element) return;
  meta.inFocusBand = isVideoCenterInFocusBand(meta.element);
}

function getQueueNeighbor(exitedId, direction) {
  const orderIds = scrollPreviewPrefetch.getOrderIds();
  const idx = orderIds.indexOf(exitedId);
  if (idx < 0) return null;
  if (direction === 'backward') {
    return orderIds[idx - 1] ?? null;
  }
  return orderIds[idx + 1] ?? null;
}

export function ScrollPreviewProvider({ children, enabled = true }) {
  const entriesRef = useRef(new Map());
  const listenersRef = useRef(new Map());
  const activeIdRef = useRef(null);
  const pendingCandidateRef = useRef(null);
  const scrollDirectionRef = useRef('forward');
  const lastScrollTopRef = useRef(0);
  const rafRef = useRef(null);

  const notifyAll = useCallback(() => {
    const activeId = activeIdRef.current;
    listenersRef.current.forEach((listener, id) => {
      listener(id === activeId);
    });
  }, []);

  const applyActiveId = useCallback((nextId) => {
    const id = nextId ? String(nextId) : null;
    if (!id || activeIdRef.current === id) return;
    activeIdRef.current = id;
    pendingCandidateRef.current = null;
    scrollPreviewPrefetch.setActiveId(id);
    notifyAll();
  }, [notifyAll]);

  const clearActive = useCallback(() => {
    if (!activeIdRef.current) return;
    activeIdRef.current = null;
    notifyAll();
  }, [notifyAll]);

  const reconcileActive = useCallback(() => {
    if (!enabled) return;

    entriesRef.current.forEach((meta) => updateEntryGeometry(meta));

    const currentActive = activeIdRef.current;

    if (currentActive) {
      const activeMeta = entriesRef.current.get(currentActive);
      const stillInBand = activeMeta?.element && activeMeta.inFocusBand;

      if (stillInBand) {
        logScrollPreviewState({
          activeId: currentActive,
          scrollDirection: scrollDirectionRef.current,
          entries: entriesRef.current,
        });
        return;
      }

      const exitedId = currentActive;
      const neighbor = getQueueNeighbor(exitedId, scrollDirectionRef.current);
      activeIdRef.current = null;
      pendingCandidateRef.current = neighbor;
      notifyAll();

      if (neighbor) {
        const neighborMeta = entriesRef.current.get(neighbor);
        if (neighborMeta?.element && neighborMeta.inFocusBand) {
          applyActiveId(neighbor);
        }
      }

      logScrollPreviewState({
        activeId: activeIdRef.current,
        pendingCandidateId: pendingCandidateRef.current,
        scrollDirection: scrollDirectionRef.current,
        entries: entriesRef.current,
        exitedId,
        pickedId: activeIdRef.current,
      });
      return;
    }

    const pending = pendingCandidateRef.current;
    if (pending) {
      const pendingMeta = entriesRef.current.get(pending);
      if (pendingMeta?.element && pendingMeta.inFocusBand) {
        applyActiveId(pending);
        logScrollPreviewState({
          activeId: activeIdRef.current,
          scrollDirection: scrollDirectionRef.current,
          entries: entriesRef.current,
          pickedId: pending,
        });
      } else {
        logScrollPreviewState({
          activeId: null,
          pendingCandidateId: pending,
          scrollDirection: scrollDirectionRef.current,
          entries: entriesRef.current,
        });
      }
      return;
    }

    const orderIds = scrollPreviewPrefetch.getOrderIds();
    let picked = null;
    for (const id of orderIds) {
      const meta = entriesRef.current.get(id);
      if (meta?.element && meta.inFocusBand) {
        picked = id;
        break;
      }
    }
    if (picked) {
      applyActiveId(picked);
    }

    logScrollPreviewState({
      activeId: activeIdRef.current,
      scrollDirection: scrollDirectionRef.current,
      entries: entriesRef.current,
      pickedId: picked,
    });
  }, [enabled, applyActiveId, notifyAll]);

  const scheduleReconcile = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      reconcileActive();
    });
  }, [reconcileActive]);

  const onScroll = useCallback(() => {
    const { top } = readScrollOffset();
    if (top > lastScrollTopRef.current + 1) {
      scrollDirectionRef.current = 'forward';
    } else if (top < lastScrollTopRef.current - 1) {
      scrollDirectionRef.current = 'backward';
    }
    lastScrollTopRef.current = top;
    scheduleReconcile();
  }, [scheduleReconcile]);

  useEffect(() => {
    if (!enabled) {
      activeIdRef.current = null;
      pendingCandidateRef.current = null;
      listenersRef.current.forEach((listener) => listener(false));
      return undefined;
    }

    lastScrollTopRef.current = readScrollOffset().top;
    scheduleReconcile();

    const unsubScroll = subscribeScroll(onScroll);
    const onViewportChange = () => scheduleReconcile();
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
  }, [enabled, onScroll, scheduleReconcile]);

  const register = useCallback((id, element) => {
    if (element) {
      element.dataset.scrollPreviewId = id;
      const meta = { element, inFocusBand: false };
      entriesRef.current.set(id, meta);
      updateEntryGeometry(meta);
      scheduleReconcile();
      return;
    }

    entriesRef.current.delete(id);
    if (activeIdRef.current === id) {
      activeIdRef.current = null;
      notifyAll();
    }
    if (pendingCandidateRef.current === id) {
      pendingCandidateRef.current = null;
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

/** True only for the single active preview (video centre inside focus band). */
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
