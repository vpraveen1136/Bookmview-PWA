import { getScrollPreviewFocusBand, getScrollPreviewViewport, getVideoVerticalCenterY } from './pageScroll.js';

const DEBUG_KEY = 'bookmview.debugScrollPreview';

export function isScrollPreviewDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

/** Temporary on-device diagnostics — localStorage bookmview.debugScrollPreview = '1' */
export function logScrollPreviewState({
  activeId,
  pendingCandidateId = null,
  scrollDirection = null,
  entries,
  exitedId = null,
  pickedId = null,
}) {
  if (!isScrollPreviewDebugEnabled()) return;

  const viewport = getScrollPreviewViewport();
  const focusBand = getScrollPreviewFocusBand();
  const rows = [];

  entries.forEach((meta, id) => {
    if (!meta?.element) return;
    const rect = meta.element.getBoundingClientRect();
    const centerY = getVideoVerticalCenterY(meta.element);
    rows.push({
      id,
      rectTop: Math.round(rect.top),
      rectBottom: Math.round(rect.bottom),
      videoCenterY: centerY != null ? Math.round(centerY) : null,
      inFocusBand: meta.inFocusBand,
    });
  });

  console.log('[scroll-preview]', {
    activeId,
    pendingCandidateId,
    scrollDirection,
    exitedId,
    pickedId,
    viewportTop: Math.round(viewport.top),
    viewportBottom: Math.round(viewport.bottom),
    focusBandTop: Math.round(focusBand.top),
    focusBandBottom: Math.round(focusBand.bottom),
    cards: rows,
  });
}
