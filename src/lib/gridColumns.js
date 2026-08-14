export const DEFAULT_GRID_COLUMNS = 2;

const STORAGE_KEY = 'bookmview.pwa.gridColumns';

export function getStoredGridColumns() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    if (value === 1 || value === 2) return value;
  } catch {
    // ignore
  }
  return DEFAULT_GRID_COLUMNS;
}

export function setStoredGridColumns(columns) {
  const next = columns === 1 ? 1 : 2;
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore
  }
  return next;
}

export function gridColumnsClass(columns) {
  return columns === 1 ? 'video-grid-cols-1' : 'video-grid-cols-2';
}
