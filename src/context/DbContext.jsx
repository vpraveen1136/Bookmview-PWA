import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { openDatabaseFromBuffer, openDatabaseFromFile } from '../db/loadDatabase.js';
import { clearPersistedDatabase, loadPersistedDatabase, savePersistedDatabase } from '../db/persistedDb.js';
import { loadWatchLibraryWithCatalog } from '../db/queries.js';

const DbContext = createContext(null);

export function DbProvider({ children }) {
  const dbRef = useRef(null);
  const [db, setDb] = useState(null);
  const [fileName, setFileName] = useState('');
  const [library, setLibrary] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [loadKind, setLoadKind] = useState(null);

  const openFromBuffer = useCallback(async (buffer, name, { persist = true } = {}) => {
    if (dbRef.current) {
      try {
        dbRef.current.close();
      } catch {
        // ignore
      }
      dbRef.current = null;
    }

    const nextDb = await openDatabaseFromBuffer(buffer);
    const { items, catalog: nextCatalog } = loadWatchLibraryWithCatalog(nextDb);
    dbRef.current = nextDb;
    setDb(nextDb);
    setFileName(name || 'bookmview.db');
    setLibrary(items);
    setCatalog(nextCatalog);
    setLoadError('');
    setLoadKind(persist ? 'user_pick' : 'restore');

    if (persist) {
      try {
        await savePersistedDatabase(name || 'bookmview.db', buffer);
      } catch (error) {
        console.warn('Could not persist database locally', error);
      }
    }
    return items;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHydrating(true);
      setLoadError('');
      try {
        const saved = await loadPersistedDatabase();
        if (cancelled || !saved?.buffer) return;
        await openFromBuffer(saved.buffer, saved.fileName, { persist: false });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to restore saved database.';
          setLoadError(message);
          try {
            await clearPersistedDatabase();
          } catch {
            // ignore
          }
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openFromBuffer]);

  const closeDatabase = useCallback(async () => {
    if (dbRef.current) {
      try {
        dbRef.current.close();
      } catch {
        // ignore
      }
      dbRef.current = null;
    }
    setDb(null);
    setFileName('');
    setLibrary([]);
    setCatalog(null);
    setLoadError('');
    setLoadKind(null);
    try {
      await clearPersistedDatabase();
    } catch {
      // ignore
    }
  }, []);

  const loadFromFile = useCallback(async (file) => {
    setLoading(true);
    setLoadError('');
    try {
      const buffer = await file.arrayBuffer();
      const items = await openFromBuffer(buffer, file.name || 'database.db', { persist: true });
      return items;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open database.';
      setLoadError(message);
      if (dbRef.current) {
        try {
          dbRef.current.close();
        } catch {
          // ignore
        }
        dbRef.current = null;
      }
      setDb(null);
      setFileName('');
      setLibrary([]);
      setCatalog(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [openFromBuffer]);

  const value = useMemo(
    () => ({
      db,
      fileName,
      library,
      catalog,
      loadError,
      loading,
      hydrating,
      loadFromFile,
      closeDatabase,
      loadKind,
      isReady: Boolean(db),
    }),
    [catalog, closeDatabase, db, fileName, hydrating, library, loadError, loadFromFile, loadKind, loading],
  );

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb() {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDb must be used within DbProvider');
  return ctx;
}
