import { hasTable } from './schema.js';

function queryAll(db, sql) {
  const result = db.exec(sql);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((vals) => {
    const row = {};
    columns.forEach((col, index) => {
      row[col] = vals[index];
    });
    return row;
  });
}

export function loadLibraryCatalog(db) {
  const tags = hasTable(db, 'tags')
    ? queryAll(db, 'SELECT id, name, color FROM tags ORDER BY lower(name) COLLATE NOCASE')
    : [];

  const authors = hasTable(db, 'authors')
    ? queryAll(db, 'SELECT user_id, username, display_name FROM authors ORDER BY lower(COALESCE(display_name, username)) COLLATE NOCASE')
    : [];

  const playlists = hasTable(db, 'playlists')
    ? queryAll(db, 'SELECT id, name FROM playlists ORDER BY lower(name) COLLATE NOCASE')
    : [];

  const sources = hasTable(db, 'content_sources')
    ? queryAll(db, 'SELECT slug, display_name FROM content_sources WHERE enabled = 1 ORDER BY sort_order ASC, display_name ASC')
    : [];

  const tagIdsByTweet = new Map();
  if (hasTable(db, 'bookmark_tags') && hasTable(db, 'tags')) {
    const rows = queryAll(db, 'SELECT tweet_id, tag_id FROM bookmark_tags');
    for (const row of rows) {
      const list = tagIdsByTweet.get(row.tweet_id) ?? [];
      list.push(row.tag_id);
      tagIdsByTweet.set(row.tweet_id, list);
    }
  }

  const playlistIdsByTweet = new Map();
  if (hasTable(db, 'playlist_items')) {
    const rows = queryAll(db, 'SELECT tweet_id, playlist_id FROM playlist_items');
    for (const row of rows) {
      const list = playlistIdsByTweet.get(row.tweet_id) ?? [];
      list.push(row.playlist_id);
      playlistIdsByTweet.set(row.tweet_id, list);
    }
  }

  const categoryByTweet = new Map();
  if (hasTable(db, 'bookmark_category_metadata')) {
    const rows = queryAll(
      db,
      `SELECT tweet_id, cinema_industry, studio, decade_bucket, personal_rating, runtime_minutes, normalized_title
       FROM bookmark_category_metadata`,
    );
    for (const row of rows) {
      categoryByTweet.set(row.tweet_id, row);
    }
  }

  const genresByTweet = new Map();
  if (hasTable(db, 'bookmark_category_genres') && hasTable(db, 'category_genres')) {
    const rows = queryAll(
      db,
      `SELECT bcg.tweet_id, g.name
       FROM bookmark_category_genres bcg
       INNER JOIN category_genres g ON g.id = bcg.genre_id`,
    );
    for (const row of rows) {
      const list = genresByTweet.get(row.tweet_id) ?? [];
      list.push(row.name);
      genresByTweet.set(row.tweet_id, list);
    }
  }

  const moodsByTweet = new Map();
  if (hasTable(db, 'bookmark_category_moods') && hasTable(db, 'category_moods')) {
    const rows = queryAll(
      db,
      `SELECT bcm.tweet_id, m.name
       FROM bookmark_category_moods bcm
       INNER JOIN category_moods m ON m.id = bcm.mood_id`,
    );
    for (const row of rows) {
      const list = moodsByTweet.get(row.tweet_id) ?? [];
      list.push(row.name);
      moodsByTweet.set(row.tweet_id, list);
    }
  }

  const castByTweet = new Map();
  if (hasTable(db, 'bookmark_category_cast') && hasTable(db, 'category_cast')) {
    const rows = queryAll(
      db,
      `SELECT bcc.tweet_id, c.name
       FROM bookmark_category_cast bcc
       INNER JOIN category_cast c ON c.id = bcc.cast_id`,
    );
    for (const row of rows) {
      const list = castByTweet.get(row.tweet_id) ?? [];
      list.push(row.name);
      castByTweet.set(row.tweet_id, list);
    }
  }

  const lookup = (table, column = 'name') => (
    hasTable(db, table) ? queryAll(db, `SELECT DISTINCT ${column} AS name FROM ${table} WHERE ${column} IS NOT NULL AND TRIM(${column}) != '' ORDER BY lower(${column}) COLLATE NOCASE`) : []
  );

  const castGroups = hasTable(db, 'category_cast_groups')
    ? queryAll(db, 'SELECT id, name FROM category_cast_groups ORDER BY lower(name) COLLATE NOCASE')
    : [];

  const castOptions = hasTable(db, 'category_cast')
    ? queryAll(
      db,
      hasTable(db, 'category_cast_groups')
        ? `SELECT c.id, c.name, c.group_id, g.name AS group_name
           FROM category_cast c
           LEFT JOIN category_cast_groups g ON g.id = c.group_id
           WHERE c.name IS NOT NULL AND TRIM(c.name) != ''
           ORDER BY lower(COALESCE(g.name, '')) COLLATE NOCASE, lower(c.name) COLLATE NOCASE`
        : `SELECT id, name, NULL AS group_id, NULL AS group_name
           FROM category_cast
           WHERE name IS NOT NULL AND TRIM(name) != ''
           ORDER BY lower(name) COLLATE NOCASE`,
    )
    : [];

  return {
    tags,
    authors,
    playlists,
    sources,
    tagIdsByTweet,
    playlistIdsByTweet,
    categoryByTweet,
    genresByTweet,
    moodsByTweet,
    castByTweet,
    castGroups,
    genreOptions: lookup('category_genres'),
    moodOptions: lookup('category_moods'),
    castOptions,
    industryOptions: hasTable(db, 'category_industries')
      ? lookup('category_industries')
      : [],
    studioOptions: hasTable(db, 'category_studios')
      ? lookup('category_studios')
      : [],
    decadeOptions: hasTable(db, 'category_decades')
      ? lookup('category_decades')
      : [],
  };
}

export function enrichBookmarkRow(bookmark, catalog) {
  const meta = catalog.categoryByTweet.get(bookmark.tweet_id);
  return {
    ...bookmark,
    tagIds: catalog.tagIdsByTweet.get(bookmark.tweet_id) ?? [],
    playlistIds: catalog.playlistIdsByTweet.get(bookmark.tweet_id) ?? [],
    genres: catalog.genresByTweet.get(bookmark.tweet_id) ?? [],
    moods: catalog.moodsByTweet.get(bookmark.tweet_id) ?? [],
    casts: catalog.castByTweet.get(bookmark.tweet_id) ?? [],
    cinemaIndustry: meta?.cinema_industry ?? null,
    studio: meta?.studio ?? null,
    decade: meta?.decade_bucket ?? null,
    personalRating: meta?.personal_rating ?? null,
    runtimeMinutes: meta?.runtime_minutes ?? null,
    normalizedTitle: meta?.normalized_title ?? null,
  };
}
