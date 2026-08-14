/**
 * Client-side shuffled discovery deck (read-only DB; order lives in PWA storage).
 */

/**
 * Membership key for eligible bookmark ids (order-independent).
 */
export function buildEligibleMembershipKey(fileName, ids = []) {
  const base = String(fileName || 'bookmview.db').trim() || 'bookmview.db';
  const sorted = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))].sort();
  return `${base}:${sorted.join(',')}`;
}

/**
 * Fisher–Yates shuffle (stable session deck).
 */
export function shuffleIds(ids, random = Math.random) {
  const out = ids.map((id) => String(id));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Keep stored deck order; drop removed ids; append any new ids (shuffled) at the end.
 */
export function reconcileDeckOrder(storedOrder, eligibleIds) {
  const eligible = new Set(eligibleIds.map((id) => String(id)));
  const kept = (storedOrder || [])
    .map((id) => String(id))
    .filter((id) => eligible.has(id));
  const missing = eligibleIds
    .map((id) => String(id))
    .filter((id) => !kept.includes(id));
  if (!missing.length) return kept;
  return [...kept, ...shuffleIds(missing)];
}

export function buildDeckIndexMap(deckOrder) {
  const map = new Map();
  deckOrder.forEach((id, index) => map.set(String(id), index));
  return map;
}

/**
 * Playable items in strict shuffled-deck order (watch queue).
 */
export function orderPlayablesByDeck(playableIds, deckOrder) {
  const indexMap = buildDeckIndexMap(deckOrder);
  return [...playableIds]
    .map((id) => String(id))
    .sort((a, b) => {
      const ia = indexMap.get(a) ?? Number.MAX_SAFE_INTEGER;
      const ib = indexMap.get(b) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
}

/**
 * Dashboard discovery feed: unseen playables first, then seen, each tier in deck order.
 */
export function orderPlayablesDiscovery(playableIds, deckOrder, seenIds) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  const indexMap = buildDeckIndexMap(deckOrder);
  return [...playableIds]
    .map((id) => String(id))
    .sort((a, b) => {
      const aSeen = seen.has(a);
      const bSeen = seen.has(b);
      if (aSeen !== bSeen) return aSeen ? 1 : -1;
      const ia = indexMap.get(a) ?? Number.MAX_SAFE_INTEGER;
      const ib = indexMap.get(b) ?? Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
}

export function sortLibraryByDeckOrder(library, deckOrder) {
  const indexMap = buildDeckIndexMap(deckOrder);
  return [...library].sort((a, b) => {
    const ia = indexMap.get(String(a.tweet_id)) ?? Number.MAX_SAFE_INTEGER;
    const ib = indexMap.get(String(b.tweet_id)) ?? Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
}

export function mapIdsToBookmarks(orderedIds, library) {
  const byId = new Map(library.map((item) => [String(item.tweet_id), item]));
  return orderedIds.map((id) => byId.get(String(id))).filter(Boolean);
}
