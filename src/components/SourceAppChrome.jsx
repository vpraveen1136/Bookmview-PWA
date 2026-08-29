import { useState } from 'react';

import { AppSlideMenu } from './AppSlideMenu.jsx';
import { FloatingPrivacyButton } from './FloatingPrivacyButton.jsx';
import { GridColumnToggle } from './GridColumnToggle.jsx';
import { PrivacyEyeButton } from './PrivacyEyeButton.jsx';

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
  const [menuOpen, setMenuOpen] = useState(false);

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
          <button
            type="button"
            className="btn btn-icon source-app-menu-btn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span className="source-app-menu-icon" aria-hidden="true">☰</span>
          </button>
          <div className="source-app-toolbar-spacer" />
          {showGridColumns ? (
            <GridColumnToggle columns={gridColumns} onChange={onGridColumnsChange} compact />
          ) : null}
          <PrivacyEyeButton className="btn btn-icon" compact />
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
      <AppSlideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
