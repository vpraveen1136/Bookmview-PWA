import { useGridColumns } from '../hooks/useGridColumns.js';

export function GridColumnToggle({ columns, onChange, compact = false }) {
  const [internalColumns, setInternalColumns] = useGridColumns();
  const activeColumns = columns ?? internalColumns;
  const setColumns = onChange ?? setInternalColumns;

  return (
    <div
      className={compact ? 'grid-col-toggle grid-col-toggle-compact' : 'grid-col-toggle'}
      role="group"
      aria-label="Grid columns"
    >
      <button
        type="button"
        className={`grid-col-btn ${activeColumns === 1 ? 'grid-col-btn-active' : ''}`}
        aria-label="1 column"
        aria-pressed={activeColumns === 1}
        onClick={() => setColumns(1)}
      >
        1
      </button>
      <button
        type="button"
        className={`grid-col-btn ${activeColumns === 2 ? 'grid-col-btn-active' : ''}`}
        aria-label="2 columns"
        aria-pressed={activeColumns === 2}
        onClick={() => setColumns(2)}
      >
        2
      </button>
    </div>
  );
}
