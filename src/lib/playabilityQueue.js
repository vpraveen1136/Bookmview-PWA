import { bookmarkHasProbeableMedia, probeBookmarkPlayability } from './playabilityProbe.js';

export const PLAYABILITY = {
  UNKNOWN: 'unknown',
  CHECKING: 'checking',
  PLAYABLE: 'playable',
  NON_PLAYABLE: 'non_playable',
  EXPIRED: 'expired',
};

/** Batch probing: show dashboard after INITIAL_DISPLAY, pause at INITIAL_CAP, extend by EXTEND on demand. */
export const PLAYABILITY_BATCH = {
  INITIAL_DISPLAY: 5,
  INITIAL_CAP: 25,
  EXTEND: 10,
};

const DEFAULT_CONCURRENCY = 4;
const NEIGHBOR_AHEAD = 24;
const NEIGHBOR_BEHIND = 4;
const NETWORK_RETRY_MS = 4000;

/**
 * Runtime playability-first queue.
 * Preserves library order for the playable feed; never reorders by check completion.
 */
export function createPlayabilityQueue({
  concurrency = DEFAULT_CONCURRENCY,
  probe = probeBookmarkPlayability,
  networkRetryMs = NETWORK_RETRY_MS,
  initialCap = PLAYABILITY_BATCH.INITIAL_CAP,
  extendBatch = PLAYABILITY_BATCH.EXTEND,
} = {}) {
  /** @type {string[]} */
  let orderedIds = [];
  /** @type {Map<string, any>} */
  let bookmarksById = new Map();
  /** @type {Map<string, { status: string }>} */
  let statusById = new Map();
  /** @type {Set<(snap: object) => void>} */
  const listeners = new Set();

  let focusId = null;
  /** @type {Set<string>} */
  let seenIdSet = new Set();
  let generation = 0;
  let activeWorkers = 0;
  let stopped = true;
  let capPaused = false;
  let playableTargetCap = initialCap;
  let networkPaused = false;
  let networkTimer = null;
  let onlineHandler = null;
  /** @type {AbortController | null} */
  let runController = null;
  let checkedCount = 0;

  function emit() {
    const snap = getSnapshot();
    listeners.forEach((listener) => {
      try {
        listener(snap);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  function getStatus(id) {
    return statusById.get(id)?.status || PLAYABILITY.UNKNOWN;
  }

  function getPlayableIds() {
    return orderedIds.filter((id) => getStatus(id) === PLAYABILITY.PLAYABLE);
  }

  function countByStatus(status) {
    let n = 0;
    for (const id of orderedIds) {
      if (getStatus(id) === status) n += 1;
    }
    return n;
  }

  function pendingCount() {
    return orderedIds.filter((id) => {
      const s = getStatus(id);
      return s === PLAYABILITY.UNKNOWN || s === PLAYABILITY.CHECKING;
    }).length;
  }

  function getSnapshot() {
    const playableIds = getPlayableIds();
    const total = orderedIds.length;
    const pending = pendingCount();
    return {
      orderedIds: [...orderedIds],
      playableIds,
      statuses: Object.fromEntries(
        orderedIds.map((id) => [id, getStatus(id)]),
      ),
      progress: {
        done: checkedCount,
        total,
        checking: countByStatus(PLAYABILITY.CHECKING),
        unknown: countByStatus(PLAYABILITY.UNKNOWN),
        playable: playableIds.length,
        nonPlayable: countByStatus(PLAYABILITY.NON_PLAYABLE) + countByStatus(PLAYABILITY.EXPIRED),
      },
      busy: activeWorkers > 0 || (!stopped && !capPaused && pending > 0),
      networkPaused,
      focusId,
      playableTargetCap,
      capPaused,
      hasMoreToProbe: pending > 0,
    };
  }

  function softPauseForCap() {
    if (capPaused && stopped) return;
    stopped = true;
    capPaused = true;
    runController?.abort();
    runController = null;
    emit();
  }

  function maybePauseForCap() {
    if (getPlayableIds().length >= playableTargetCap) {
      softPauseForCap();
      return true;
    }
    return false;
  }

  function resumeProbing() {
    if (!orderedIds.length || pendingCount() === 0) return;
    stopped = false;
    capPaused = false;
    if (!runController || runController.signal.aborted) {
      runController = new AbortController();
      bindOnline();
    }
    pump();
    emit();
  }

  function scoreCandidate(id, focusIndex) {
    const index = orderedIds.indexOf(id);
    if (index < 0) return Number.POSITIVE_INFINITY;

    // Prefer probing unseen candidates earlier in the deck.
    const unseenBoost = seenIdSet.has(id) ? 20000 : 0;

    if (focusIndex < 0) return index + unseenBoost;

    // Prefer upcoming items near the current watch position for swipe continuity.
    if (index > focusIndex && index <= focusIndex + NEIGHBOR_AHEAD) {
      return (index - focusIndex) * 0.01 + unseenBoost;
    }
    if (index < focusIndex && index >= focusIndex - NEIGHBOR_BEHIND) {
      return 100 + (focusIndex - index) + unseenBoost;
    }
    // Then remaining deck order (ahead first, then behind).
    if (index > focusIndex) return 1000 + (index - focusIndex) + unseenBoost;
    return 5000 + (focusIndex - index) + unseenBoost;
  }

  function pickNextId() {
    const focusIndex = focusId ? orderedIds.indexOf(focusId) : -1;
    let bestId = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const id of orderedIds) {
      if (getStatus(id) !== PLAYABILITY.UNKNOWN) continue;
      const score = scoreCandidate(id, focusIndex);
      if (score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    if (bestId) {
      // Claim immediately so concurrent workers never probe the same id.
      statusById.set(bestId, { status: PLAYABILITY.CHECKING });
    }
    return bestId;
  }

  async function runOne(gen, signal) {
    const id = pickNextId();
    if (!id) return false;

    const bookmark = bookmarksById.get(id);
    emit();

    try {
      if (!bookmarkHasProbeableMedia(bookmark)) {
        statusById.set(id, { status: PLAYABILITY.NON_PLAYABLE });
        checkedCount += 1;
        emit();
        return true;
      }

      const result = await probe(bookmark, signal);
      if (gen !== generation || signal.aborted) return false;

      if (result === 'network_error') {
        statusById.set(id, { status: PLAYABILITY.UNKNOWN });
        pauseForNetwork();
        emit();
        return false;
      }

      statusById.set(id, {
        status: result === 'playable' ? PLAYABILITY.PLAYABLE : PLAYABILITY.NON_PLAYABLE,
      });
      checkedCount += 1;
      if (result === 'playable') {
        maybePauseForCap();
      }
      emit();
      return true;
    } catch (error) {
      if (error?.name === 'AbortError' || gen !== generation) return false;
      statusById.set(id, { status: PLAYABILITY.UNKNOWN });
      pauseForNetwork();
      emit();
      return false;
    }
  }

  function pauseForNetwork() {
    networkPaused = true;
    if (networkTimer) clearTimeout(networkTimer);
    networkTimer = setTimeout(() => {
      networkPaused = false;
      pump();
      emit();
    }, networkRetryMs);
  }

  async function workerLoop(gen, signal) {
    activeWorkers += 1;
    emit();
    try {
      while (!stopped && gen === generation && !signal.aborted) {
        if (networkPaused || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
          networkPaused = true;
          emit();
          break;
        }
        const didWork = await runOne(gen, signal);
        if (!didWork) break;
      }
    } finally {
      activeWorkers -= 1;
      emit();
      if (!stopped && gen === generation) pump();
    }
  }

  function pump() {
    if (stopped || capPaused || networkPaused) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      networkPaused = true;
      emit();
      return;
    }
    const signal = runController?.signal;
    if (!signal || signal.aborted) return;

    const needed = Math.min(
      concurrency,
      orderedIds.filter((id) => getStatus(id) === PLAYABILITY.UNKNOWN).length,
    ) - activeWorkers;

    for (let i = 0; i < needed; i += 1) {
      workerLoop(generation, signal);
    }
  }

  function bindOnline() {
    if (typeof window === 'undefined' || onlineHandler) return;
    onlineHandler = () => {
      networkPaused = false;
      if (!stopped) pump();
      emit();
    };
    window.addEventListener('online', onlineHandler);
  }

  function unbindOnline() {
    if (typeof window === 'undefined' || !onlineHandler) return;
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }

  function importStatuses(library, statusMap = {}, { autoStart = false } = {}) {
    generation += 1;
    stopped = !autoStart;
    capPaused = false;
    playableTargetCap = initialCap;
    networkPaused = false;
    checkedCount = 0;
    focusId = null;
    if (networkTimer) {
      clearTimeout(networkTimer);
      networkTimer = null;
    }
    runController?.abort();
    runController = autoStart ? new AbortController() : null;

    orderedIds = [];
    bookmarksById = new Map();
    statusById = new Map();

    const allowed = new Set(Object.values(PLAYABILITY));

    for (const bookmark of library || []) {
      const id = String(bookmark?.tweet_id || '').trim();
      if (!id || bookmarksById.has(id)) continue;
      orderedIds.push(id);
      bookmarksById.set(id, bookmark);
      const cached = statusMap[id];
      const status = allowed.has(cached) ? cached : PLAYABILITY.UNKNOWN;
      statusById.set(id, { status });
      if (status !== PLAYABILITY.UNKNOWN && status !== PLAYABILITY.CHECKING) {
        checkedCount += 1;
      }
    }

    const playableCount = getPlayableIds().length;
    if (playableCount >= playableTargetCap) {
      playableTargetCap = playableCount;
    }

    if (autoStart) {
      if (playableCount >= playableTargetCap && pendingCount() === 0) {
        softPauseForCap();
      } else {
        bindOnline();
        emit();
        pump();
      }
    } else {
      unbindOnline();
      emit();
    }
  }

  function reset(library) {
    importStatuses(library, {}, { autoStart: true });
  }

  function stop() {
    stopped = true;
    capPaused = false;
    playableTargetCap = initialCap;
    generation += 1;
    runController?.abort();
    runController = null;
    if (networkTimer) {
      clearTimeout(networkTimer);
      networkTimer = null;
    }
    unbindOnline();
    orderedIds = [];
    bookmarksById = new Map();
    statusById = new Map();
    checkedCount = 0;
    focusId = null;
    emit();
  }

  function setFocus(tweetId) {
    const id = tweetId ? String(tweetId) : null;
    if (focusId === id) return;
    focusId = id;
    emit();
    if (!stopped && !capPaused) pump();
  }

  function setSeenIds(ids = []) {
    seenIdSet = new Set((ids || []).map((id) => String(id)).filter(Boolean));
    emit();
    if (!stopped && !capPaused) pump();
  }

  function markExpired(tweetId) {
    const id = String(tweetId || '').trim();
    if (!id || !statusById.has(id)) return;
    const current = getStatus(id);
    if (current === PLAYABILITY.EXPIRED || current === PLAYABILITY.NON_PLAYABLE) return;
    statusById.set(id, { status: PLAYABILITY.EXPIRED });
    emit();
    if (!stopped && !capPaused) pump();
  }

  function extendPlayableCap(by = extendBatch) {
    const amount = Number(by) || extendBatch;
    playableTargetCap += amount;
    resumeProbing();
  }

  async function checkBookmark(bookmark) {
    const id = String(bookmark?.tweet_id || '').trim();
    if (!id) return { status: PLAYABILITY.UNKNOWN };

    if (!bookmarksById.has(id)) {
      bookmarksById.set(id, bookmark);
      if (!orderedIds.includes(id)) orderedIds.push(id);
    }

    const prior = getStatus(id);
    if (prior === PLAYABILITY.CHECKING) return { status: PLAYABILITY.CHECKING };

    statusById.set(id, { status: PLAYABILITY.CHECKING });
    emit();

    const controller = new AbortController();
    try {
      if (!bookmarkHasProbeableMedia(bookmark)) {
        statusById.set(id, { status: PLAYABILITY.NON_PLAYABLE });
        if (prior === PLAYABILITY.UNKNOWN || prior === PLAYABILITY.CHECKING) {
          checkedCount += 1;
        }
        emit();
        return { status: PLAYABILITY.NON_PLAYABLE };
      }

      const result = await probe(bookmark, controller.signal);
      const nextStatus = result === 'playable'
        ? PLAYABILITY.PLAYABLE
        : (result === 'network_error' ? PLAYABILITY.UNKNOWN : PLAYABILITY.NON_PLAYABLE);

      statusById.set(id, { status: nextStatus });
      if (prior === PLAYABILITY.UNKNOWN || prior === PLAYABILITY.CHECKING) {
        checkedCount += 1;
      }
      emit();
      return { status: nextStatus };
    } catch {
      statusById.set(id, { status: PLAYABILITY.UNKNOWN });
      emit();
      return { status: PLAYABILITY.UNKNOWN };
    }
  }

  function getBookmark(tweetId) {
    return bookmarksById.get(String(tweetId || '')) || null;
  }

  function getPlayableBookmarks() {
    return getPlayableIds().map((id) => bookmarksById.get(id)).filter(Boolean);
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(getSnapshot());
    return () => listeners.delete(listener);
  }

  return {
    reset,
    importStatuses,
    stop,
    setFocus,
    setSeenIds,
    markExpired,
    extendPlayableCap,
    checkBookmark,
    getSnapshot,
    getStatus,
    getBookmark,
    getPlayableBookmarks,
    getPlayableIds,
    subscribe,
    PLAYABILITY,
    PLAYABILITY_BATCH,
  };
}

/**
 * Pure helper for tests: build playable ids in library order from a status map.
 */
export function playableIdsInLibraryOrder(orderedIds, statusById) {
  return orderedIds.filter((id) => statusById[id] === PLAYABILITY.PLAYABLE);
}
