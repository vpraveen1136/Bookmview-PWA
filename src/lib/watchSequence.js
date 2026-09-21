const STORAGE_KEY = 'bookmview.pwa.watchSequence';
const MAX_SEQUENCE_IDS = 5000;

function normalizeIds(ids = []) {
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    const value = String(id || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= MAX_SEQUENCE_IDS) break;
  }
  return out;
}

export function saveWatchSequence(source, ids) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const sequenceIds = normalizeIds(ids);
  if (!source || !sequenceIds.length) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      source,
      ids: sequenceIds,
      savedAt: Date.now(),
    }));
  } catch {
    // Session storage can be unavailable in private/locked-down contexts.
  }
}

export function loadWatchSequence(source) {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || parsed.source !== source) return [];
    return normalizeIds(parsed.ids);
  } catch {
    return [];
  }
}
