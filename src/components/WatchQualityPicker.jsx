import { useEffect, useRef, useState } from 'react';

import { getVariantHeight } from '../lib/streamPlayback.js';

function shortQualityLabel(label) {
  return String(label || '')
    .replace(/\s*·\s*recommended/i, '')
    .replace(/\s*·\s*may buffer/i, '')
    .trim();
}

/**
 * On-screen quality picker for Stream / Direct CDN / Full file modes.
 */
export function WatchQualityPicker({
  variants = [],
  value,
  defaultUrl,
  onChange,
  formatLabel,
  onOpenChange,
  className = '',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const setOpenState = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const selectedUrl = value || defaultUrl || variants[0]?.url || '';
  const current = variants.find((v) => v.url === selectedUrl) || variants[0];
  const buttonLabel = current ? shortQualityLabel(formatLabel?.(current)) : 'Quality';
  const canChoose = variants.length > 1;

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpenState(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!variants?.length) return null;

  return (
    <div
      ref={rootRef}
      className={`watch-quality ${open ? 'is-open' : ''} ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="watch-quality-btn"
        aria-expanded={canChoose ? open : false}
        aria-haspopup={canChoose ? 'listbox' : undefined}
        aria-label={`Quality: ${buttonLabel}`}
        onClick={() => {
          if (canChoose) setOpenState((prev) => !prev);
        }}
      >
        <span className="watch-quality-value">{buttonLabel}</span>
        {canChoose ? <span className="watch-quality-caret" aria-hidden="true">▾</span> : null}
      </button>
      {open && canChoose ? (
        <ul className="watch-picker-menu watch-quality-menu" role="listbox" aria-label="Video quality">
          {variants.map((variant) => {
            const isActive = variant.url === selectedUrl;
            const height = getVariantHeight(variant);
            return (
              <li key={variant.url} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={`watch-picker-option watch-quality-option ${isActive ? 'is-active' : ''}`}
                  onClick={() => {
                    onChange?.(variant.url);
                    setOpenState(false);
                  }}
                >
                  <span>{formatLabel?.(variant) || (height ? `${height}p` : 'Default')}</span>
                  {isActive ? <span className="watch-quality-check" aria-hidden="true">✓</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
