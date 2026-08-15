import { getScrollPreviewViewport } from './pageScroll.js';

const DEBUG_KEY = 'bookmview.debugScrollPreview';

export function isScrollPreviewDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

/** Temporary on-device diagnostics — enable with localStorage bookmview.debugScrollPreview = '1' */
export function logScrollPreviewState({
  activeId,
  entries,
  exitedId = null,
  pickedId = null,
}) {
  if (!isScrollPreviewDebugEnabled()) return;

  const viewport = getScrollPreviewViewport();
  const rows = [];

  entries.forEach((meta, id) => {
    if (!meta?.element) return;
    const rect = meta.element.getBoundingClientRect();
    rows.push({
      id,
      rectTop: Math.round(rect.top),
      rectBottom: Math.round(rect.bottom),
      intersectionRatio: Number((meta.intersectionRatio ?? 0).toFixed(3)),
      ioRatio: meta.ioRatio != null ? Number(meta.ioRatio.toFixed(3)) : null,
      overlaps: meta.overlaps,
      completelyOutside: meta.completelyOutside,
    });
  });

  console.log('[scroll-preview]', {
    activeId,
    exitedId,
    pickedId,
    viewportTop: Math.round(viewport.top),
    viewportBottom: Math.round(viewport.bottom),
    viewportLeft: Math.round(viewport.left),
    viewportRight: Math.round(viewport.right),
    cards: rows,
  });
}
