import { FloatingPrivacyButton } from './FloatingPrivacyButton.jsx';
import { GridColumnToggle } from './GridColumnToggle.jsx';

export function SourceAppChrome({
  search,
  onSearchChange,
  searchPlaceholder = 'Search titles, authors, genre, cast, studio…',
  gridColumns,
  onGridColumnsChange,
  showGridColumns = true,
  leadingAction = null,
  children,
}) {
  return (
    <>
      <header className="source-app-chrome">
        <div className="source-app-toolbar">
          {leadingAction ? (
            <button
              type="button"
              className="btn btn-icon source-app-back-btn"
              aria-label={leadingAction.ariaLabel || leadingAction.label}
              onClick={leadingAction.onClick}
            >
              {leadingAction.label}
            </button>
          ) : null}
          <div className="source-app-toolbar-spacer" />
          {showGridColumns ? (
            <GridColumnToggle columns={gridColumns} onChange={onGridColumnsChange} compact />
          ) : null}
        </div>
        <div className="source-app-search-wrap">
          <input
            className="search-input source-app-search"
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </header>

      <div className="source-app-content">
        {children}
      </div>

      <FloatingPrivacyButton />
    </>
  );
}
