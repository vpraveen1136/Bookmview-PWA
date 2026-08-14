export function getBookmarkColumns(db) {
  const rows = db.exec("PRAGMA table_info('bookmarks')");
  if (!rows.length) return new Set();
  const names = rows[0].values.map((row) => row[1]);
  return new Set(names);
}

export function hasTable(db, tableName) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(tableName)) return false;
  const result = db.exec(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${tableName}' LIMIT 1`,
  );
  return Boolean(result.length && result[0].values.length);
}
