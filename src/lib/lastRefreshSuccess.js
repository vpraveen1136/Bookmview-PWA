/**
 * Refresh-eligible bookmarks for PWA playability probing.
 *
 * Tray stamps `last_refresh_cycle_started_at` when that bookmark's refresh
 * succeeded or the URL was already active (skipped). Failures clear the stamp.
 *
 * Eligibility is per-bookmark (its own last outcome), not “only the most recent
 * tray session”. So refreshing only X still leaves previously OK SpankBang rows
 * eligible until they fail in a later refresh.
 */

export function hasRefreshEligibleStamp(bookmark) {
  return Boolean(String(bookmark?.last_refresh_cycle_started_at || '').trim());
}

export function libraryHasAnyRefreshStamps(library = []) {
  return (library || []).some((item) => hasRefreshEligibleStamp(item));
}

/**
 * Bookmarks whose last refresh outcome was OK (success or already-active skip).
 * If the DB has no stamps yet (legacy / not re-exported), returns the full list.
 */
export function filterRefreshEligible(items, library = items) {
  const list = Array.isArray(items) ? items : [];
  const scope = Array.isArray(library) && library.length ? library : list;
  if (!libraryHasAnyRefreshStamps(scope)) return list;
  return list.filter((item) => hasRefreshEligibleStamp(item));
}

export function isRefreshEligible(bookmark, library = []) {
  if (!bookmark) return false;
  if (!libraryHasAnyRefreshStamps(library)) return true;
  return hasRefreshEligibleStamp(bookmark);
}

/** @deprecated */
export function getLatestRefreshCycleStartedAt(library = []) {
  let latest = '';
  for (const item of library) {
    const value = String(item?.last_refresh_cycle_started_at || '').trim();
    if (value && value > latest) latest = value;
  }
  return latest || null;
}

/** @deprecated use filterRefreshEligible */
export function filterLastRefreshSuccess(items, library = items) {
  return filterRefreshEligible(items, library);
}

/** @deprecated use isRefreshEligible */
export function isLastRefreshSuccess(bookmark, library = []) {
  return isRefreshEligible(bookmark, library);
}
