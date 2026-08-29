import { Link } from 'react-router-dom';
import { useState } from 'react';

import { useDb } from '../context/DbContext.jsx';
import { usePrivacy } from '../context/PrivacyContext.jsx';
import { getBookmarkDisplayTitle, getBookmarkThumbnailUrl } from '../lib/playback.js';
import { clearPlaybackPosition, listContinueWatching } from '../lib/watchPlaybackPosition.js';

export function ResumeBar() {
  const { library } = useDb();
  const { contentHidden } = usePrivacy();
  const [, setVersion] = useState(0);
  const [item] = listContinueWatching(library || [], { limit: 1 });

  if (!item) return null;

  const title = getBookmarkDisplayTitle(item);
  const thumb = getBookmarkThumbnailUrl(item);

  return (
    <div className="resume-bar">
      <Link className="resume-bar-link" to={`/watch/${encodeURIComponent(item.tweet_id)}`}>
        {contentHidden ? (
          <span className="resume-bar-thumb privacy-placeholder">...</span>
        ) : thumb ? (
          <img className="resume-bar-thumb" src={thumb} alt="" />
        ) : (
          <span className="resume-bar-thumb" />
        )}
        <span className="resume-bar-copy">
          <small>Continue watching</small>
          <strong className={contentHidden ? 'privacy-hidden-text' : ''}>{contentHidden ? '...' : title}</strong>
        </span>
        <span className="resume-bar-action">Play</span>
      </Link>
      <button
        type="button"
        className="resume-bar-dismiss"
        aria-label="Remove continue watching"
        onClick={() => {
          clearPlaybackPosition(item.tweet_id);
          setVersion((value) => value + 1);
        }}
      >
        ×
      </button>
    </div>
  );
}
