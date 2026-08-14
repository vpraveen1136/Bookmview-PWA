import { getBookmarkColumns, hasTable } from './schema.js';
import { enrichBookmarkRow, loadLibraryCatalog } from './catalog.js';

function rowToObject(columns, values) {
  const row = {};
  columns.forEach((col, index) => {
    row[col] = values[index];
  });
  return row;
}

function queryAll(db, sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((vals) => rowToObject(columns, vals));
}

export function loadWatchLibrary(db) {
  return loadWatchLibraryWithCatalog(db).items;
}

export function loadWatchLibraryWithCatalog(db) {
  if (!hasTable(db, 'bookmarks')) {
    throw new Error('This file does not look like a BookmView database (missing bookmarks table).');
  }

  const bookmarkCols = getBookmarkColumns(db);
  const hasSourceSlug = bookmarkCols.has('source_slug');
  const hasHls = bookmarkCols.has('hls_manifest_url');
  const hasHlsResolved = bookmarkCols.has('hls_resolved_at');
  const hasProgressiveResolved = bookmarkCols.has('progressive_resolved_at');
  const hasRefreshCycle = bookmarkCols.has('last_refresh_cycle_started_at');

  const selectFields = [
    'b.tweet_id',
    'b.tweet_url',
    'b.local_title',
    'b.text',
    'b.bookmarked_at',
    'b.posted_at',
    'b.author_user_id',
    hasSourceSlug ? 'b.source_slug' : "'x' AS source_slug",
    hasHls ? 'b.hls_manifest_url' : 'NULL AS hls_manifest_url',
    hasHlsResolved ? 'b.hls_resolved_at' : 'NULL AS hls_resolved_at',
    hasProgressiveResolved ? 'b.progressive_resolved_at' : 'NULL AS progressive_resolved_at',
    hasRefreshCycle ? 'b.last_refresh_cycle_started_at' : 'NULL AS last_refresh_cycle_started_at',
    bookmarkCols.has('is_favorite') ? 'b.is_favorite' : '0 AS is_favorite',
    bookmarkCols.has('is_archived') ? 'b.is_archived' : '0 AS is_archived',
    bookmarkCols.has('is_read') ? 'b.is_read' : '0 AS is_read',
    bookmarkCols.has('last_viewed_at') ? 'b.last_viewed_at' : 'NULL AS last_viewed_at',
  ].join(', ');

  const hasMedia = hasTable(db, 'bookmark_media');
  let bookmarks;

  if (hasMedia) {
    const hlsClause = hasHls
      ? `(b.hls_manifest_url IS NOT NULL AND TRIM(b.hls_manifest_url) != '')`
      : '0';
    bookmarks = queryAll(
      db,
      `
        SELECT DISTINCT ${selectFields}
        FROM bookmarks b
        WHERE (
          EXISTS (
            SELECT 1 FROM bookmark_media m
            WHERE m.tweet_id = b.tweet_id
              AND m.media_type IN ('video', 'animated_gif')
          )
          OR ${hlsClause}
        )
        ORDER BY COALESCE(b.bookmarked_at, b.posted_at) DESC
      `,
    );
  } else {
    bookmarks = queryAll(
      db,
      `
        SELECT ${selectFields}
        FROM bookmarks b
        WHERE 1=1
        ${hasHls ? `AND (b.hls_manifest_url IS NOT NULL AND TRIM(b.hls_manifest_url) != '')` : ''}
        ORDER BY COALESCE(b.bookmarked_at, b.posted_at) DESC
      `,
    );
  }

  const mediaByTweet = hasMedia ? loadMediaByTweet(db) : new Map();
  const catalog = loadLibraryCatalog(db);
  const items = bookmarks.map((bookmark) => {
    const base = {
      ...bookmark,
      is_favorite: Boolean(bookmark.is_favorite),
      is_archived: Boolean(bookmark.is_archived),
      is_read: Boolean(bookmark.is_read),
      media: mediaByTweet.get(bookmark.tweet_id) ?? [],
    };
    return enrichBookmarkRow(base, catalog);
  });
  return { items, catalog };
}

function loadMediaByTweet(db) {
  const mediaCols = new Set(
    (db.exec("PRAGMA table_info('bookmark_media')")[0]?.values ?? []).map((row) => row[1]),
  );
  const hasVariants = mediaCols.has('variants_json');

  const rows = queryAll(
    db,
    `
      SELECT tweet_id, position, media_type, url, preview_url, width, height, duration_ms
      ${hasVariants ? ', variants_json' : ''}
      FROM bookmark_media
      ORDER BY tweet_id, position ASC
    `,
  );

  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.tweet_id) ?? [];
    list.push(row);
    map.set(row.tweet_id, list);
  }
  return map;
}

export function getBookmarkById(db, tweetId) {
  const all = loadWatchLibrary(db);
  return all.find((item) => item.tweet_id === tweetId) ?? null;
}
