import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { WatchFeedItem } from '../components/WatchFeedItem.jsx';
import { WatchRightDrawer } from '../components/WatchRightDrawer.jsx';
import { useDb } from '../context/DbContext.jsx';
import { usePlayability } from '../context/PlayabilityContext.jsx';
import { useBookmarkPlayback } from '../hooks/useBookmarkPlayback.js';
import { useVerticalSwipe } from '../hooks/useVerticalSwipe.js';
import { getBookmarkDisplayTitle, getBookmarkPageUrl } from '../lib/playback.js';

const TRANSITION_MS = 280;
const AUTO_HIDE_MS = 3000;
const DOUBLE_TAP_MS = 320;
const SEEK_ZONE_RATIO = 0.38;

const WATCH_INTERACTIVE_SELECTOR = '.watch-seek-hit, .watch-quality, .watch-speed, .watch-toolbar-btn, .watch-toolbar-zone, .watch-center-play, .watch-title-toggle, .watch-top-more, .watch-drawer, .watch-title-banner';

function sourceLabel(bookmark, catalog) {
  const slug = bookmark?.source_slug || 'x';
  const source = catalog?.sources?.find((item) => item.slug === slug);
  return source?.display_name || slug;
}

export function WatchPage() {
  const { tweetId } = useParams();
  const navigate = useNavigate();
  const { isReady, hydrating, catalog, library } = useDb();
  const {
    playableBookmarks,
    busy,
    networkPaused,
    setFocus,
    markExpired,
    markSeen,
    progress,
    requestMorePlayables,
    hasMoreToProbe,
    capPaused,
  } = usePlayability();

  const libraryById = useMemo(() => {
    const map = new Map();
    for (const item of library || []) map.set(String(item.tweet_id), item);
    return map;
  }, [library]);

  const feed = playableBookmarks;
  const currentId = String(tweetId || '');

  const [activeId, setActiveId] = useState(currentId);
  const [offsetY, setOffsetY] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [findingNext, setFindingNext] = useState(false);
  const [pendingNext, setPendingNext] = useState(false);
  const hideControlsTimer = useRef(null);
  const failureHandledRef = useRef(null);
  const seekApiRef = useRef(null);
  const tapGestureRef = useRef({ time: 0, x: 0, pending: null });

  useEffect(() => {
    if (currentId && currentId !== activeId && !animating) {
      setActiveId(currentId);
      setOffsetY(0);
      setFindingNext(false);
      setPendingNext(false);
      setControlsVisible(false);
      setDrawerOpen(false);
      setTitleVisible(false);
    }
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const index = useMemo(
    () => feed.findIndex((item) => String(item.tweet_id) === activeId),
    [feed, activeId],
  );

  const bookmark = useMemo(() => {
    if (index >= 0) return feed[index];
    return libraryById.get(activeId) || libraryById.get(currentId) || null;
  }, [activeId, currentId, feed, index, libraryById]);

  const inPlayableQueue = index >= 0;

  useEffect(() => {
    setFocus(activeId || null);
    return () => setFocus(null);
  }, [activeId, setFocus]);

  useEffect(() => {
    if (activeId) markSeen(activeId);
  }, [activeId, markSeen]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevTouch = body.style.touchAction;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.touchAction = prevTouch;
    };
  }, []);

  const playbackState = useBookmarkPlayback(bookmark);

  const slots = useMemo(() => {
    if (!inPlayableQueue) {
      return [null, bookmark, null];
    }
    return [
      feed[index - 1] || null,
      feed[index] || null,
      feed[index + 1] || null,
    ];
  }, [bookmark, feed, inPlayableQueue, index]);

  const watchPath = useCallback(
    (id) => `/watch/${encodeURIComponent(id)}`,
    [],
  );

  const goToTweetId = useCallback((nextId, { toward } = {}) => {
    if (!nextId || nextId === activeId || animating) return;
    setAnimating(true);
    setOffsetY(toward === 'prev' ? 100 : -100);
    setControlsVisible(false);
    setDrawerOpen(false);
    setTitleVisible(false);
    setFindingNext(false);
    setPendingNext(false);

    window.setTimeout(() => {
      setActiveId(nextId);
      setOffsetY(0);
      setAnimating(false);
      navigate(watchPath(nextId), { replace: true });
    }, TRANSITION_MS);
  }, [activeId, animating, navigate, watchPath]);

  const goRelative = useCallback((delta) => {
    if (animating) return;

    if (!inPlayableQueue) {
      if (delta > 0) {
        if (feed.length > 0) {
          goToTweetId(feed[0].tweet_id, { toward: 'next' });
        } else {
          setFindingNext(true);
          setPendingNext(true);
          requestMorePlayables();
        }
      }
      return;
    }

    const nextIndex = index + delta;
    if (nextIndex >= 0 && nextIndex < feed.length) {
      goToTweetId(feed[nextIndex].tweet_id, { toward: delta > 0 ? 'next' : 'prev' });
      return;
    }

    if (delta > 0 && nextIndex >= feed.length) {
      setFindingNext(true);
      setPendingNext(true);
      if (hasMoreToProbe || capPaused) {
        requestMorePlayables();
      }
    }
  }, [animating, feed, goToTweetId, hasMoreToProbe, capPaused, inPlayableQueue, index, requestMorePlayables]);

  useEffect(() => {
    if (!pendingNext || animating) return;
    if (!inPlayableQueue) {
      if (feed.length > 0) {
        goToTweetId(feed[0].tweet_id, { toward: 'next' });
      }
      return;
    }
    if (index >= 0 && index < feed.length - 1) {
      goToTweetId(feed[index + 1].tweet_id, { toward: 'next' });
    }
  }, [animating, feed, goToTweetId, inPlayableQueue, index, pendingNext]);

  useEffect(() => {
    if (!findingNext) return;
    if (busy) return;
    if (hasMoreToProbe) return;
    setFindingNext(false);
    setPendingNext(false);
  }, [busy, findingNext, hasMoreToProbe]);

  const onPlaybackError = useCallback((_short, detail) => {
    if (!activeId || failureHandledRef.current === activeId) return;
    failureHandledRef.current = activeId;
    markExpired(activeId);

    const nextId = inPlayableQueue && index >= 0 && index < feed.length - 1
      ? feed[index + 1].tweet_id
      : (feed.length > 0 && String(feed[0]?.tweet_id) !== activeId ? feed[0].tweet_id : null);

    if (nextId) {
      goToTweetId(nextId, { toward: 'next' });
    } else {
      setFindingNext(true);
      requestMorePlayables();
    }
  }, [activeId, feed, goToTweetId, inPlayableQueue, index, markExpired, requestMorePlayables]);

  useEffect(() => {
    failureHandledRef.current = null;
  }, [activeId]);

  const swipeHandlers = useVerticalSwipe({
    enabled: !animating && !findingNext && !scrubbing,
    onSwipeUp: () => {
      if (drawerOpen) {
        setDrawerOpen(false);
      }
      goRelative(1);
    },
    onSwipeDown: () => {
      if (drawerOpen) {
        setDrawerOpen(false);
      }
      goRelative(-1);
    },
  });

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => {
      if (!drawerOpen && !scrubbing && !titleVisible) {
        setControlsVisible(false);
        setTitleVisible(false);
      }
    }, AUTO_HIDE_MS);
  }, [drawerOpen, scrubbing, titleVisible]);

  useEffect(() => {
    if (controlsVisible && !drawerOpen && !scrubbing && !titleVisible) scheduleHideControls();
  }, [controlsVisible, drawerOpen, scrubbing, titleVisible, scheduleHideControls]);

  const onTapVideo = useCallback((event) => {
    if (findingNext) return;
    if (drawerOpen) {
      setDrawerOpen(false);
      return;
    }
    if (event?.target?.closest?.(WATCH_INTERACTIVE_SELECTOR)) {
      return;
    }

    setControlsVisible((visible) => {
      const next = !visible;
      if (next) scheduleHideControls();
      else setTitleVisible(false);
      return next;
    });
  }, [drawerOpen, findingNext, scheduleHideControls]);

  const onViewportPointerUp = useCallback((event) => {
    if (findingNext) return;
    if (drawerOpen) {
      setDrawerOpen(false);
      return;
    }
    if (event?.target?.closest?.(WATCH_INTERACTIVE_SELECTOR)) {
      return;
    }

    const width = event.currentTarget?.clientWidth || window.innerWidth;
    const x = event.clientX;
    const now = Date.now();
    const last = tapGestureRef.current;

    if (now - last.time < DOUBLE_TAP_MS && Math.abs(x - last.x) < 48) {
      if (last.pending) window.clearTimeout(last.pending);
      last.pending = null;
      last.time = 0;

      if (x < width * SEEK_ZONE_RATIO) {
        seekApiRef.current?.seekBy?.(-10);
        setControlsVisible(true);
        scheduleHideControls();
      } else if (x > width * (1 - SEEK_ZONE_RATIO)) {
        seekApiRef.current?.seekBy?.(10);
        setControlsVisible(true);
        scheduleHideControls();
      }
      event.stopPropagation();
      return;
    }

    last.time = now;
    last.x = x;
    if (last.pending) window.clearTimeout(last.pending);
    last.pending = window.setTimeout(() => {
      last.pending = null;
      onTapVideo(event);
    }, DOUBLE_TAP_MS);
  }, [drawerOpen, findingNext, onTapVideo, scheduleHideControls]);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((open) => {
      const next = !open;
      if (next) {
        setControlsVisible(true);
        if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
      } else {
        scheduleHideControls();
      }
      return next;
    });
  }, [scheduleHideControls]);

  const toggleTitle = useCallback(() => {
    setTitleVisible((v) => !v);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (drawerOpen || findingNext) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        goRelative(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        goRelative(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, findingNext, goRelative]);

  useEffect(() => () => {
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current);
    if (tapGestureRef.current.pending) window.clearTimeout(tapGestureRef.current.pending);
  }, []);

  const onShare = useCallback(async () => {
    if (!bookmark) return;
    const pageUrl = getBookmarkPageUrl(bookmark);
    const shareUrl = pageUrl || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: bookmark.local_title || 'BookmView', url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // user cancelled
    }
  }, [bookmark]);

  if (hydrating) {
    return <div className="page empty-state">Restoring your library…</div>;
  }

  if (!isReady) {
    return <Navigate to="/" replace />;
  }

  if (!bookmark) {
    return (
      <div className="page">
        <p className="empty-state">Bookmark not found in the loaded database.</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }

  const trackStyle = {
    transform: `translate3d(0, calc(-100dvh + ${offsetY}dvh), 0)`,
    transition: animating ? `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none',
  };

  const counterLabel = inPlayableQueue && feed.length
    ? `${index + 1} / ${feed.length}`
    : null;

  const titleMeta = {
    title: getBookmarkDisplayTitle(bookmark),
    source: sourceLabel(bookmark, catalog),
    onToggleTitle: toggleTitle,
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };

  return (
    <div className={`watch-feed ${controlsVisible ? 'controls-visible' : ''}`} {...swipeHandlers}>
      {controlsVisible && !findingNext ? (
        <div className="watch-feed-top watch-feed-top-overlay watch-chrome-fade is-visible">
          <button
            type="button"
            className="watch-back-icon"
            aria-label="Back"
            onClick={handleBack}
          >
            ‹
          </button>
          {counterLabel ? (
            <span className="watch-counter">{counterLabel}</span>
          ) : (
            <span className="watch-counter" />
          )}
          <button
            type="button"
            className="watch-more-btn watch-top-more"
            aria-label="More actions"
            aria-expanded={drawerOpen}
            onClick={(event) => {
              event.stopPropagation();
              toggleDrawer();
            }}
          >
            ⋮
          </button>
        </div>
      ) : null}

      <div
        className="watch-viewport"
        onPointerUp={onViewportPointerUp}
        role="presentation"
      >
        <div className="watch-track" style={trackStyle}>
          {slots.map((item, slotIndex) => {
            const isCurrent = slotIndex === 1;
            return (
              <div
                key={item?.tweet_id || `empty-${slotIndex}`}
                className={`watch-track-cell ${isCurrent ? 'is-current' : 'is-offscreen'}`}
                aria-hidden={!isCurrent}
              >
                {item ? (
                  <WatchFeedItem
                    bookmark={item}
                    playback={isCurrent ? playbackState.playback : null}
                    playbackState={isCurrent ? playbackState : null}
                    isActive={isCurrent}
                    showControls={isCurrent && controlsVisible && !findingNext}
                    titleVisible={isCurrent && titleVisible}
                    titleMeta={isCurrent ? titleMeta : null}
                    onError={isCurrent ? onPlaybackError : undefined}
                    onScrubbingChange={isCurrent ? setScrubbing : undefined}
                    seekApiRef={isCurrent ? seekApiRef : null}
                  />
                ) : (
                  <div className="watch-slot watch-slot-empty" />
                )}
              </div>
            );
          })}
        </div>

        {findingNext ? (
          <div className="watch-finding-next" role="status">
            <p className="playability-finding-title">Finding next video…</p>
            <p className="playability-finding-sub">
              {networkPaused
                ? 'Waiting for network…'
                : busy
                  ? `Checking ${Math.min(progress.done + (progress.checking || 0), progress.total)} of ${progress.total}`
                  : 'Still looking for a playable video'}
            </p>
            <div className="playability-pulse" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      <WatchRightDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        bookmark={bookmark}
        playbackState={playbackState}
        onShare={onShare}
      />
    </div>
  );
}
