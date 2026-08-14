const IDB_NAME = 'bookmview-watch';
const IDB_VERSION = 1;
const STORE_NAME = 'snapshots';
const RECORD_KEY = 'bookmview-db';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * @returns {Promise<{ fileName: string, savedAt: string, buffer: ArrayBuffer } | null>}
 */
export async function loadPersistedDatabase() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    request.onerror = () => reject(request.error ?? new Error('Failed to read saved database.'));
    request.onsuccess = () => {
      const record = request.result;
      if (!record?.buffer) {
        resolve(null);
        return;
      }
      resolve({
        fileName: String(record.fileName || 'bookmview.db'),
        savedAt: String(record.savedAt || ''),
        buffer: record.buffer,
      });
    };
  });
}

export async function savePersistedDatabase(fileName, buffer) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save database.'));
    tx.objectStore(STORE_NAME).put(
      {
        fileName: fileName || 'bookmview.db',
        savedAt: new Date().toISOString(),
        buffer,
      },
      RECORD_KEY,
    );
  });
}

export async function clearPersistedDatabase() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear saved database.'));
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
  });
}
