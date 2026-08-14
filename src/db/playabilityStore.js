const IDB_NAME = 'bookmview-watch-meta';
const IDB_VERSION = 3;
const STORE_PLAYABILITY = 'playability';
const STORE_HLS = 'hlsHealth';
const STORE_DISCOVERY = 'discoveryDeck';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available.'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open playability store.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_HLS)) {
        db.createObjectStore(STORE_HLS);
      }
      if (!db.objectStoreNames.contains(STORE_PLAYABILITY)) {
        db.createObjectStore(STORE_PLAYABILITY);
      }
      if (!db.objectStoreNames.contains(STORE_DISCOVERY)) {
        db.createObjectStore(STORE_DISCOVERY);
      }
    };
  });
}

function storageKey(fileName) {
  return String(fileName || 'bookmview.db').trim() || 'bookmview.db';
}

/**
 * @returns {Promise<{ eligibleKey: string, statuses: Record<string, string>, checkedAt: string } | null>}
 */
export async function loadPlayabilityCache(fileName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYABILITY, 'readonly');
    const request = tx.objectStore(STORE_PLAYABILITY).get(storageKey(fileName));
    request.onerror = () => reject(request.error ?? new Error('Failed to read playability cache.'));
    request.onsuccess = () => {
      const record = request.result;
      if (!record?.statuses) {
        resolve(null);
        return;
      }
      resolve({
        eligibleKey: String(record.eligibleKey || ''),
        statuses: record.statuses,
        checkedAt: String(record.checkedAt || ''),
      });
    };
  });
}

export async function savePlayabilityCache(fileName, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYABILITY, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save playability cache.'));
    tx.objectStore(STORE_PLAYABILITY).put(
      {
        eligibleKey: String(record.eligibleKey || ''),
        statuses: record.statuses || {},
        checkedAt: String(record.checkedAt || new Date().toISOString()),
      },
      storageKey(fileName),
    );
  });
}

export async function clearPlayabilityCache(fileName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYABILITY, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear playability cache.'));
    tx.objectStore(STORE_PLAYABILITY).delete(storageKey(fileName));
  });
}

export function buildPlayabilityEligibleKey(fileName, orderedIds = []) {
  const ids = orderedIds.map((id) => String(id || '').trim()).filter(Boolean);
  const sorted = [...new Set(ids)].sort();
  return `${storageKey(fileName)}:${sorted.join(',')}`;
}

/**
 * @returns {Promise<{ eligibleKey: string, deckOrder: string[], seenIds: string[] } | null>}
 */
export async function loadDiscoveryDeck(fileName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DISCOVERY, 'readonly');
    const request = tx.objectStore(STORE_DISCOVERY).get(storageKey(fileName));
    request.onerror = () => reject(request.error ?? new Error('Failed to read discovery deck.'));
    request.onsuccess = () => {
      const record = request.result;
      if (!record?.deckOrder?.length) {
        resolve(null);
        return;
      }
      resolve({
        eligibleKey: String(record.eligibleKey || ''),
        deckOrder: record.deckOrder.map((id) => String(id)),
        seenIds: (record.seenIds || []).map((id) => String(id)),
      });
    };
  });
}

export async function saveDiscoveryDeck(fileName, record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DISCOVERY, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save discovery deck.'));
    tx.objectStore(STORE_DISCOVERY).put(
      {
        eligibleKey: String(record.eligibleKey || ''),
        deckOrder: record.deckOrder || [],
        seenIds: record.seenIds || [],
        updatedAt: new Date().toISOString(),
      },
      storageKey(fileName),
    );
  });
}
