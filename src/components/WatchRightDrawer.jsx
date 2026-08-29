import { useState } from 'react';

import { WatchPlaybackControls } from './WatchPlaybackControls.jsx';
import { DefaultPlaybackModeSettings } from './DefaultPlaybackModeSettings.jsx';
import { useDb } from '../context/DbContext.jsx';
import { usePwaActions } from '../hooks/usePwaActions.js';
import {
  getBookmarkPageUrl,
  resolvePlayMediaMp4Url,
} from '../lib/playback.js';
import { canUseSpankbangEmbedPlayback } from '../lib/spankbangEmbed.js';
import {
  getBookmarkHlsUrl,
  getBookmarkMp4Url,
  getBookmarkSourceUrl,
} from '../lib/bookmarkCopyUrls.js';
import { isLocalProxyUrl } from '../lib/playbackModes.js';

async function copyText(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function WatchRightDrawer({
  open,
  onClose,
  bookmark,
  playbackState,
  onShare,
}) {
  const { updateBookmarkLocal } = useDb();
  const { enqueue } = usePwaActions();
  const [modeOpen, setModeOpen] = useState(false);
  const [copyNote, setCopyNote] = useState('');

  const pageUrl = bookmark ? getBookmarkPageUrl(bookmark) : null;
  const playMediaUrl = bookmark ? resolvePlayMediaMp4Url(bookmark) : null;
  const spankbangEmbed = bookmark ? canUseSpankbangEmbedPlayback(bookmark) : false;
  const playback = playbackState?.playback;
  const sourceCopyUrl = bookmark ? getBookmarkSourceUrl(bookmark) : null;
  const mp4CopyUrl = bookmark ? getBookmarkMp4Url(bookmark) : null;
  const hlsCopyUrl = bookmark ? getBookmarkHlsUrl(bookmark) : null;

  const onCopy = async (label, url) => {
    const ok = await copyText(url);
    setCopyNote(ok ? `Copied ${label}` : `Could not copy ${label}`);
    window.setTimeout(() => setCopyNote(''), 2000);
  };

  const closeAll = () => {
    setModeOpen(false);
    onClose?.();
  };

  const toggleArchive = () => {
    if (!bookmark?.tweet_id) return;
    const archived = !bookmark.is_archived;
    updateBookmarkLocal(bookmark.tweet_id, { is_archived: archived });
    enqueue(archived ? 'archive' : 'unarchive', bookmark.tweet_id);
  };

  const toggleFavourite = () => {
    if (!bookmark?.tweet_id) return;
    const favourite = !bookmark.is_favorite;
    updateBookmarkLocal(bookmark.tweet_id, { is_favorite: favourite });
    enqueue(favourite ? 'favourite' : 'unfavourite', bookmark.tweet_id);
  };

  return (
    <>
      <div
        className={`watch-drawer-backdrop ${open ? 'is-open' : ''}`}
        onClick={closeAll}
        aria-hidden={!open}
      />
      <aside
        className={`watch-drawer ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        aria-label="More actions"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <div className="watch-drawer-actions">
          <button
            type="button"
            className="watch-drawer-action"
            onClick={() => {
              toggleFavourite();
              closeAll();
            }}
          >
            <span className="watch-drawer-icon" aria-hidden="true">★</span>
            <span className="watch-drawer-label">{bookmark?.is_favorite ? 'Unfavourite' : 'Favourite'}</span>
          </button>
          <button
            type="button"
            className="watch-drawer-action"
            onClick={() => {
              toggleArchive();
              closeAll();
            }}
          >
            <span className="watch-drawer-icon" aria-hidden="true">A</span>
            <span className="watch-drawer-label">{bookmark?.is_archived ? 'Unarchive' : 'Archive'}</span>
          </button>
          {!spankbangEmbed ? (
            <button
              type="button"
              className="watch-drawer-action"
              onClick={() => setModeOpen((v) => !v)}
            >
              <span className="watch-drawer-icon" aria-hidden="true">M</span>
              <span className="watch-drawer-label">Mode</span>
            </button>
          ) : null}
          <button
            type="button"
            className="watch-drawer-action"
            onClick={() => onCopy('source URL', sourceCopyUrl)}
            disabled={!sourceCopyUrl}
          >
            <span className="watch-drawer-icon" aria-hidden="true">S</span>
            <span className="watch-drawer-label">Source</span>
          </button>
          {!spankbangEmbed ? (
            <button
              type="button"
              className="watch-drawer-action"
              onClick={() => onCopy('MP4 URL', mp4CopyUrl)}
              disabled={!mp4CopyUrl}
            >
              <span className="watch-drawer-icon" aria-hidden="true">4</span>
              <span className="watch-drawer-label">MP4</span>
            </button>
          ) : null}
          {!spankbangEmbed ? (
            <button
              type="button"
              className="watch-drawer-action"
              onClick={() => onCopy('HLS URL', hlsCopyUrl)}
              disabled={!hlsCopyUrl}
            >
              <span className="watch-drawer-icon" aria-hidden="true">H</span>
              <span className="watch-drawer-label">HLS</span>
            </button>
          ) : null}
          <button
            type="button"
            className="watch-drawer-action"
            onClick={() => {
              onShare?.();
              closeAll();
            }}
          >
            <span className="watch-drawer-icon" aria-hidden="true">↗</span>
            <span className="watch-drawer-label">Share</span>
          </button>
          {playMediaUrl ? (
            <a
              className="watch-drawer-action"
              href={playMediaUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => closeAll()}
            >
              <span className="watch-drawer-icon" aria-hidden="true">◉</span>
              <span className="watch-drawer-label">Play Browser</span>
            </a>
          ) : null}
          {pageUrl ? (
            <a
              className="watch-drawer-action"
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => closeAll()}
            >
              <span className="watch-drawer-icon" aria-hidden="true">↗</span>
              <span className="watch-drawer-label">Open Source</span>
            </a>
          ) : null}
        </div>

        {copyNote ? <p className="watch-drawer-note">{copyNote}</p> : null}

        {modeOpen && !spankbangEmbed ? (
          <div className="watch-drawer-mode-panel">
            <DefaultPlaybackModeSettings compact />
            <WatchPlaybackControls
              bookmark={bookmark}
              playbackState={playbackState}
              variant="sheet"
            />
            {playback?.url && isLocalProxyUrl(playback.url) ? (
              <p className="watch-drawer-note">
                Desktop proxy URL — re-export with Direct CDN on desktop.
              </p>
            ) : null}
          </div>
        ) : null}
      </aside>
    </>
  );
}
