const STORAGE_KEY = 'bookmview.pwa.playbackPositions';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function getPlaybackPosition(tweetId) {
  if (!tweetId) return 0;
  const map = readMap();
  const value = Number(map[tweetId]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function setPlaybackPosition(tweetId, seconds) {
  if (!tweetId) return;
  const map = readMap();
  if (!Number.isFinite(seconds) || seconds <= 1) {
    delete map[tweetId];
  } else {
    map[tweetId] = Math.round(seconds * 10) / 10;
  }
  writeMap(map);
}

export function listContinueWatching(library, { limit = 12 } = {}) {
  const map = readMap();
  const entries = Object.entries(map)
    .map(([tweetId, position]) => ({
      tweetId,
      position: Number(position),
      bookmark: library.find((item) => item.tweet_id === tweetId),
    }))
    .filter((entry) => entry.bookmark && entry.position > 3)
    .sort((a, b) => b.position - a.position)
    .slice(0, limit);
  return entries.map((entry) => entry.bookmark);
}
