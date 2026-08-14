import { useEffect, useRef, useState } from 'react';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function WatchSpeedPicker({ value = 1, onChange, onOpenChange, className = '' }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const label = value === 1 ? '1×' : `${value}×`;

  const setOpenState = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpenState(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={rootRef}
      className={`watch-speed ${open ? 'is-open' : ''} ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="watch-toolbar-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Playback speed: ${label}`}
        onClick={() => setOpenState((prev) => !prev)}
      >
        {label}
      </button>
      {open ? (
        <ul className="watch-picker-menu" role="listbox" aria-label="Playback speed">
          {SPEEDS.map((speed) => {
            const active = speed === value;
            return (
              <li key={speed} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`watch-picker-option ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    onChange?.(speed);
                    setOpenState(false);
                  }}
                >
                  <span>{speed === 1 ? '1×' : `${speed}×`}</span>
                  {active ? <span className="watch-quality-check" aria-hidden="true">✓</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
