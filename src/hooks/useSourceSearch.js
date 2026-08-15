import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useSourceSearch() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = useMemo(
    () => String(searchParams.get('search') || '').trim(),
    [searchParams],
  );

  const setSearch = useCallback((value) => {
    const next = String(value || '').trim();
    const params = new URLSearchParams(searchParams);
    if (next) params.set('search', next);
    else params.delete('search');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return { search, setSearch };
}
