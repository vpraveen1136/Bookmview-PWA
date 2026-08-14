import { useCallback, useState } from 'react';

import { getStoredGridColumns, setStoredGridColumns } from '../lib/gridColumns.js';

export function useGridColumns() {
  const [columns, setColumnsState] = useState(() => getStoredGridColumns());

  const setColumns = useCallback((next) => {
    setColumnsState(setStoredGridColumns(next));
  }, []);

  return [columns, setColumns];
}
