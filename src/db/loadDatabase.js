import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

let sqlModulePromise = null;

function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
  }
  return sqlModulePromise;
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<import('sql.js').Database>}
 */
export async function openDatabaseFromBuffer(buffer) {
  const SQL = await getSqlModule();
  return new SQL.Database(new Uint8Array(buffer));
}

export async function openDatabaseFromFile(file) {
  const buffer = await file.arrayBuffer();
  return openDatabaseFromBuffer(buffer);
}
