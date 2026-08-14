import { WatchQualityPicker } from './WatchQualityPicker.jsx';
import { WatchSpeedPicker } from './WatchSpeedPicker.jsx';

export function WatchBottomToolbar({
  muted,
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
  playbackRate,
  onPlaybackRateChange,
  qualityProps,
  onPickerOpenChange,
}) {
  const onPickerChange = (open) => {
    onPickerOpenChange?.(open);
  };

  return (
    <div
      className="watch-toolbar-zone"
      onClick={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchMove={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <div className="watch-bottom-toolbar">
      {qualityProps ? (
        <WatchQualityPicker
          className="watch-toolbar-quality"
          onOpenChange={onPickerChange}
          {...qualityProps}
        />
      ) : null}
      <WatchSpeedPicker
        value={playbackRate}
        onChange={onPlaybackRateChange}
        onOpenChange={onPickerChange}
      />
      <button
        type="button"
        className="watch-toolbar-btn"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={onToggleMute}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <button
        type="button"
        className="watch-toolbar-btn watch-toolbar-fullscreen"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        onClick={onToggleFullscreen}
      >
        ⛶
      </button>
      </div>
    </div>
  );
}
