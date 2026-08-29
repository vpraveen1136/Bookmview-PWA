import { useState } from 'react';
import { Link } from 'react-router-dom';

import { usePrivacy } from '../context/PrivacyContext.jsx';
import { useScrollPreviewActive, useScrollPreviewRegistration } from '../context/ScrollPreviewContext.jsx';
import { useLongPress } from '../hooks/useLongPress.js';
import { usePwaActions } from '../hooks/usePwaActions.js';
import { useDb } from '../context/DbContext.jsx';
import { BookmarkQuickActionsSheet } from './BookmarkQuickActionsSheet.jsx';
import { BookmarkScrollPreview } from './BookmarkScrollPreview.jsx';
import { getBookmarkDisplayTitle, getBookmarkPageUrl, getBookmarkThumbnailUrl } from '../lib/playback.js';

export function BookmarkGridCard({
  item,
  to,
  duration,
  sourceLabel,
  statusBadge = null,
  subtitleParts = [],
  onCheckPlayability,
  checkingPlayability = false,
  scrollPreviewEnabled = false,
  scrollPreviewActive = false,
  cardRef = null,
}) {
  const { updateBookmarkLocal } = useDb();
  const { enqueue } = usePwaActions();
  const { contentHidden } = usePrivacy();
  const previewRegisterRef = useScrollPreviewRegistration(item.tweet_id);
  const previewActiveFromScroll = useScrollPreviewActive(item.tweet_id);
  const scrollPreviewIsActive = scrollPreviewEnabled
    ? previewActiveFromScroll
    : scrollPreviewActive;
  const thumbMeasureRef = scrollPreviewEnabled ? previewRegisterRef : cardRef;
  const [actionsOpen, setActionsOpen] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const thumb = getBookmarkThumbnailUrl(item);
  const title = getBookmarkDisplayTitle(item);

  const longPress = useLongPress({
    onLongPress: () => setActionsOpen(true),
  });

  const subtitle = subtitleParts.filter(Boolean).join(' · ') || 'Video';
  const pageUrl = getBookmarkPageUrl(item);

  const toggleArchive = () => {
    const archived = !item.is_archived;
    updateBookmarkLocal(item.tweet_id, { is_archived: archived });
    enqueue(archived ? 'archive' : 'unarchive', item.tweet_id);
  };

  const toggleFavourite = () => {
    const favourite = !item.is_favorite;
    updateBookmarkLocal(item.tweet_id, { is_favorite: favourite });
    enqueue(favourite ? 'favourite' : 'unfavourite', item.tweet_id);
  };

  const copyText = async (label, value) => {
    if (!value || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <>
      <Link
        className="grid-card"
        to={to}
        onTouchStart={longPress.onTouchStart}
        onTouchEnd={longPress.onTouchEnd}
        onTouchMove={longPress.onTouchMove}
        onMouseDown={longPress.onMouseDown}
        onMouseUp={longPress.onMouseUp}
        onMouseLeave={longPress.onMouseLeave}
        onContextMenu={longPress.onContextMenu}
        onClickCapture={longPress.onClickCapture}
      >
        <div className="thumb-wrap" ref={thumbMeasureRef}>
          {contentHidden ? (
            <div className="thumb thumb-placeholder privacy-placeholder" aria-hidden="true">···</div>
          ) : scrollPreviewEnabled ? (
            <BookmarkScrollPreview
              bookmark={item}
              active={scrollPreviewIsActive}
              placeholder={statusBadge?.label || 'Video'}
            />
          ) : thumb ? (
            <img
              className={`thumb thumb-fade ${thumbLoaded ? 'is-loaded' : ''}`}
              src={thumb}
              alt=""
              loading="lazy"
              draggable={false}
              onLoad={() => setThumbLoaded(true)}
            />
          ) : (
            <div className="thumb thumb-placeholder">
              {statusBadge?.label || 'Video'}
            </div>
          )}
          {duration ? <span className="duration-badge">{duration}</span> : null}
          {item.is_favorite ? <span className="fav-badge" aria-label="Favorite">★</span> : null}
          {item.is_archived ? <span className="archive-badge" aria-label="Archived">👎</span> : null}
          {statusBadge ? (
            <span
              className={`play-status-dot ${statusBadge.className}`}
              title={statusBadge.label}
              aria-label={statusBadge.label}
            >
              {statusBadge.text}
            </span>
          ) : null}
        </div>
        <div className="item-meta">
          <div className={`item-title ${contentHidden ? 'privacy-hidden-text' : ''}`}>
            {contentHidden ? '···' : title}
          </div>
          <div className={`item-sub ${contentHidden ? 'privacy-hidden-text' : ''}`}>
            {contentHidden ? '···' : subtitle}
          </div>
        </div>
      </Link>

      <BookmarkQuickActionsSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={contentHidden ? 'Bookmark' : title}
        actions={[
          {
            id: 'toggle-favourite',
            label: item.is_favorite ? 'Unfavourite' : 'Favourite',
            onClick: toggleFavourite,
          },
          {
            id: 'toggle-archive',
            label: item.is_archived ? 'Unarchive' : 'Archive',
            onClick: toggleArchive,
          },
          {
            id: 'check-playability',
            label: checkingPlayability ? 'Checking playability…' : 'Check Playability',
            disabled: checkingPlayability || !onCheckPlayability,
            onClick: () => onCheckPlayability?.(item),
          },
          {
            id: 'copy-title',
            label: 'Copy Title',
            onClick: () => copyText('title', title),
          },
          {
            id: 'copy-source',
            label: 'Copy Source URL',
            disabled: !pageUrl || !navigator.clipboard,
            onClick: () => copyText('source', pageUrl),
          },
          {
            id: 'open-source',
            label: 'Open Source',
            disabled: !pageUrl,
            onClick: () => window.open(pageUrl, '_blank', 'noopener,noreferrer'),
          },
        ]}
      />
    </>
  );
}
