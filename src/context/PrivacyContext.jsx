import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const PrivacyContext = createContext(null);

/**
 * Privacy mode hides library/dashboard thumbnails and titles.
 * Always hidden on launch; re-hidden when returning from another app.
 */
export function PrivacyProvider({ children }) {
  const [contentHidden, setContentHidden] = useState(true);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setContentHidden(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const toggleContentHidden = useCallback(() => {
    setContentHidden((current) => !current);
  }, []);

  const value = useMemo(
    () => ({
      contentHidden,
      toggleContentHidden,
      setContentHidden,
    }),
    [contentHidden, toggleContentHidden],
  );

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy must be used within PrivacyProvider');
  return ctx;
}
