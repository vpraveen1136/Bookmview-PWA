import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function BookmarkQuickActionsSheet({
  open,
  onClose,
  title,
  actions = [],
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const sheet = (
    <div className="sheet-root sheet-root-overlay" role="dialog" aria-modal="true" aria-label={title || 'Bookmark actions'}>
      <button type="button" className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet-panel sheet-panel-actions">
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">{title || 'Bookmark'}</h2>
          </div>
          <button type="button" className="btn sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet-body sheet-actions">
          {actions.map((action) => (
            <button
              key={action.id || action.label}
              type="button"
              className="sheet-action-btn"
              disabled={action.disabled}
              onClick={() => {
                action.onClick?.();
                if (!action.keepOpen) onClose();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
