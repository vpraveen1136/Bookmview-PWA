import { useState } from 'react';
import { Link } from 'react-router-dom';

import { usePrivacy } from '../context/PrivacyContext.jsx';
import { useScrollPreviewActive, useScrollPreviewRegistration } from '../context/ScrollPreviewContext.jsx';
import { useLongPress } from '../hooks/useLongPress.js';
import { BookmarkQuickActionsSheet } from './BookmarkQuickActionsSheet.jsx';
import { BookmarkScrollPreview } from './BookmarkScrollPreview.jsx';
import { getBookmarkDisplayTitle, getBookmarkThumbnailUrl } from '../lib/playback.js';

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
  const { contentHidden } = usePrivacy();
  const previewRegisterRef = useScrollPreviewRegistration(item.tweet_id);
  const previewActiveFromScroll = useScrollPreviewActive(item.tweet_id);
  const scrollPreviewIsActive = scrollPreviewEnabled
    ? previewActiveFromScroll
    : scrollPreviewActive;
  const thumbMeasureRef = scrollPreviewEnabled ? previewRegisterRef : cardRef;
  const [actionsOpen, setActionsOpen] = useState(false);
  const thumb = getBookmarkThumbnailUrl(item);
  const title = getBookmarkDisplayTitle(item);

  const longPress = useLongPress({
    onLongPress: () => setActionsOpen(true),
    disabled: !onCheckPlayability,
  });

  const subtitle = subtitleParts.filter(Boolean).join(' · ') || 'Video';

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
            <img className="thumb" src={thumb} alt="" loading="lazy" draggable={false} />
          ) : (
            <div className="thumb thumb-placeholder">
              {statusBadge?.label || 'Video'}
            </div>
          )}
          {duration ? <span className="duration-badge">{duration}</span> : null}
          {item.is_favorite ? <span className="fav-badge" aria-label="Favorite">★</span> : null}
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
            id: 'check-playability',
            label: checkingPlayability ? 'Checking playability…' : 'Check Playability',
            disabled: checkingPlayability || !onCheckPlayability,
            onClick: () => onCheckPlayability?.(item),
          },
        ]}
      />
    </>
  );
}
