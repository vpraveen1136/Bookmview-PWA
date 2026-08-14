import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  buildPlayabilityEligibleKey,
  loadDiscoveryDeck,
  loadPlayabilityCache,
  saveDiscoveryDeck,
  savePlayabilityCache,
} from '../db/playabilityStore.js';
import { useDb } from './DbContext.jsx';
import { createPlayabilityQueue, PLAYABILITY, PLAYABILITY_BATCH } from '../lib/playabilityQueue.js';
import {
  mapIdsToBookmarks,
  orderPlayablesByDeck,
  orderPlayablesDiscovery,
  reconcileDeckOrder,
  shuffleIds,
  sortLibraryByDeckOrder,
} from '../lib/discoveryDeck.js';
import { filterRefreshEligible } from '../lib/lastRefreshSuccess.js';

const PlayabilityContext = createContext(null);

export function PlayabilityProvider({ children }) {
  const { library, fileName, isReady, loadKind } = useDb();
  const queueRef = useRef(null);
  if (!queueRef.current) {
    queueRef.current = createPlayabilityQueue({ concurrency: 4 });
  }

  const [snapshot, setSnapshot] = useState(() => queueRef.current.getSnapshot());
  const [deckOrder, setDeckOrder] = useState([]);
  const [seenIds, setSeenIds] = useState(() => new Set());
  const [deckReady, setDeckReady] = useState(false);
  const initKeyRef = useRef('');
  const saveTimerRef = useRef(null);
  const deckSaveTimerRef = useRef(null);

  const eligibleLibrary = useMemo(
    () => filterRefreshEligible(library || [], library || []),
    [library],
  );

  const eligibleIds = useMemo(
    () => eligibleLibrary.map((item) => String(item.tweet_id)),
    [eligibleLibrary],
  );

  const eligibleKey = useMemo(
    () => buildPlayabilityEligibleKey(fileName, eligibleIds),
    [eligibleIds, fileName],
  );

  useEffect(() => {
    const queue = queueRef.current;
    return queue.subscribe(setSnapshot);
  }, []);

  const persistDeck = useCallback((order, seen) => {
    if (!fileName || !order?.length) return;
    if (deckSaveTimerRef.current) clearTimeout(deckSaveTimerRef.current);
    deckSaveTimerRef.current = window.setTimeout(() => {
      saveDiscoveryDeck(fileName, {
        eligibleKey,
        deckOrder: order,
        seenIds: [...seen],
      }).catch(() => {
        // ignore persistence errors
      });
    }, 400);
  }, [eligibleKey, fileName]);

  useEffect(() => {
    const queue = queueRef.current;
    if (!isReady || !fileName || !eligibleIds.length) {
      initKeyRef.current = '';
      setDeckOrder([]);
      setSeenIds(new Set());
      setDeckReady(false);
      queue.stop();
      return undefined;
    }

    const initKey = `${fileName}:${loadKind}:${eligibleKey}`;
    if (initKeyRef.current === initKey) return undefined;

    let cancelled = false;
    setDeckReady(false);

    (async () => {
      let nextDeckOrder = [];
      let nextSeen = new Set();

      try {
        const stored = await loadDiscoveryDeck(fileName);
        if (stored?.seenIds?.length) {
          nextSeen = new Set(stored.seenIds);
        }
        if (
          loadKind !== 'user_pick'
          && stored?.eligibleKey === eligibleKey
          && stored.deckOrder?.length
        ) {
          nextDeckOrder = reconcileDeckOrder(stored.deckOrder, eligibleIds);
        } else {
          nextDeckOrder = shuffleIds(eligibleIds);
        }
      } catch {
        nextDeckOrder = shuffleIds(eligibleIds);
      }

      if (cancelled) return;

      setDeckOrder(nextDeckOrder);
      setSeenIds(nextSeen);
      setDeckReady(true);
      persistDeck(nextDeckOrder, nextSeen);

      const sortedLibrary = sortLibraryByDeckOrder(eligibleLibrary, nextDeckOrder);
      queue.setSeenIds([...nextSeen]);

      if (loadKind === 'user_pick') {
        queue.importStatuses(sortedLibrary, {}, { autoStart: true });
        if (!cancelled) initKeyRef.current = initKey;
        return;
      }

      try {
        const cached = await loadPlayabilityCache(fileName);
        if (cancelled) return;
        if (cached?.eligibleKey === eligibleKey && cached.statuses) {
          queue.importStatuses(sortedLibrary, cached.statuses, { autoStart: true });
        } else {
          queue.importStatuses(sortedLibrary, {}, { autoStart: true });
        }
      } catch {
        if (!cancelled) {
          queue.importStatuses(sortedLibrary, {}, { autoStart: true });
        }
      }
      if (!cancelled) initKeyRef.current = initKey;
    })();

    return () => {
      cancelled = true;
    };
  }, [eligibleKey, eligibleIds, eligibleLibrary, fileName, isReady, loadKind, persistDeck]);

  useEffect(() => {
    const queue = queueRef.current;
    if (!isReady || !fileName) return undefined;

    const persist = (snap) => {
      if (!fileName || !snap?.orderedIds?.length) return;
      const key = buildPlayabilityEligibleKey(fileName, snap.orderedIds);
      savePlayabilityCache(fileName, {
        eligibleKey: key,
        statuses: snap.statuses || {},
        checkedAt: new Date().toISOString(),
      }).catch(() => {
        // ignore persistence errors
      });
    };

    const unsub = queue.subscribe((snap) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => persist(snap), 500);
    });

    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [fileName, isReady]);

  useEffect(() => () => {
    initKeyRef.current = '';
    queueRef.current?.stop();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (deckSaveTimerRef.current) clearTimeout(deckSaveTimerRef.current);
  }, []);

  const markSeen = useCallback((tweetId) => {
    const id = String(tweetId || '').trim();
    if (!id) return;
    setSeenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      queueRef.current.setSeenIds([...next]);
      persistDeck(deckOrder, next);
      return next;
    });
  }, [deckOrder, persistDeck]);

  const shuffleDeck = useCallback(() => {
    if (!eligibleIds.length) return;
    const nextOrder = shuffleIds(eligibleIds);
    setDeckOrder(nextOrder);
    persistDeck(nextOrder, seenIds);

    const sortedLibrary = sortLibraryByDeckOrder(eligibleLibrary, nextOrder);
    const statuses = snapshot.statuses || {};
    queueRef.current.importStatuses(sortedLibrary, statuses, { autoStart: true });
    queueRef.current.setSeenIds([...seenIds]);
  }, [eligibleIds, eligibleLibrary, persistDeck, seenIds, snapshot.statuses]);

  const runCheck = useCallback(() => {
    if (!fileName || !eligibleLibrary.length || !deckOrder.length) return;
    initKeyRef.current = '';
    const sortedLibrary = sortLibraryByDeckOrder(eligibleLibrary, deckOrder);
    queueRef.current.reset(sortedLibrary);
    queueRef.current.setSeenIds([...seenIds]);
  }, [deckOrder, eligibleLibrary, fileName, seenIds]);

  const setFocus = useCallback((tweetId) => {
    queueRef.current.setFocus(tweetId);
  }, []);

  const markExpired = useCallback((tweetId) => {
    queueRef.current.markExpired(tweetId);
  }, []);

  const getStatus = useCallback((tweetId) => queueRef.current.getStatus(tweetId), []);

  const deckOrderedPlayableIds = useMemo(() => {
    if (!deckReady || !deckOrder.length) return snapshot.playableIds || [];
    return orderPlayablesByDeck(snapshot.playableIds || [], deckOrder);
  }, [deckOrder, deckReady, snapshot.playableIds]);

  const discoveryOrderedPlayableIds = useMemo(() => {
    if (!deckReady || !deckOrder.length) return deckOrderedPlayableIds;
    return orderPlayablesDiscovery(deckOrderedPlayableIds, deckOrder, seenIds);
  }, [deckOrderedPlayableIds, deckOrder, deckReady, seenIds]);

  const playableBookmarks = useMemo(() => {
    if (!isReady) return [];
    return mapIdsToBookmarks(deckOrderedPlayableIds, eligibleLibrary);
  }, [deckOrderedPlayableIds, eligibleLibrary, isReady]);

  const discoveryBookmarks = useMemo(() => {
    if (!isReady) return [];
    return mapIdsToBookmarks(discoveryOrderedPlayableIds, eligibleLibrary);
  }, [discoveryOrderedPlayableIds, eligibleLibrary, isReady]);

  const playableIds = useMemo(
    () => playableBookmarks.map((item) => String(item.tweet_id)),
    [playableBookmarks],
  );

  const hasCachedResults = useMemo(() => {
    const progress = snapshot.progress || {};
    return (progress.done || 0) > 0 && !snapshot.busy;
  }, [snapshot]);

  const requestMorePlayables = useCallback(() => {
    queueRef.current.extendPlayableCap(PLAYABILITY_BATCH.EXTEND);
  }, []);

  const checkPlayability = useCallback(async (bookmarkOrTweetId) => {
    const tweetId = typeof bookmarkOrTweetId === 'string'
      ? bookmarkOrTweetId
      : bookmarkOrTweetId?.tweet_id;
    const bookmark = typeof bookmarkOrTweetId === 'object' && bookmarkOrTweetId
      ? bookmarkOrTweetId
      : library.find((item) => String(item.tweet_id) === String(tweetId));
    if (!bookmark) return null;
    return queueRef.current.checkBookmark(bookmark);
  }, [library]);

  const value = useMemo(
    () => ({
      snapshot,
      playableBookmarks,
      discoveryBookmarks,
      playableIds,
      deckOrder,
      seenIds,
      deckReady,
      eligibleCount: eligibleLibrary.length,
      progress: snapshot.progress || { done: 0, total: 0, playable: 0 },
      busy: Boolean(snapshot.busy),
      networkPaused: Boolean(snapshot.networkPaused),
      capPaused: Boolean(snapshot.capPaused),
      playableTargetCap: snapshot.playableTargetCap || PLAYABILITY_BATCH.INITIAL_CAP,
      hasMoreToProbe: Boolean(snapshot.hasMoreToProbe),
      hasCachedResults,
      runCheck,
      checkPlayability,
      requestMorePlayables,
      shuffleDeck,
      markSeen,
      setFocus,
      markExpired,
      getStatus,
      PLAYABILITY,
      PLAYABILITY_BATCH,
    }),
    [
      deckOrder,
      deckReady,
      discoveryBookmarks,
      eligibleLibrary.length,
      getStatus,
      hasCachedResults,
      markExpired,
      markSeen,
      playableBookmarks,
      playableIds,
      requestMorePlayables,
      checkPlayability,
      runCheck,
      shuffleDeck,
      seenIds,
      setFocus,
      snapshot,
    ],
  );

  return (
    <PlayabilityContext.Provider value={value}>
      {children}
    </PlayabilityContext.Provider>
  );
}

export function usePlayability() {
  const ctx = useContext(PlayabilityContext);
  if (!ctx) throw new Error('usePlayability must be used within PlayabilityProvider');
  return ctx;
}
