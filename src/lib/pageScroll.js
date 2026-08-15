export const SCROLL_ROOT_SELECTOR = '.app-shell-body';
const WINDOW_SCROLL_CLASS = 'app-uses-window-scroll';
const PREFIX = 'bookmview.pwa.scroll';

export function usesWindowScroll() {
  return document.documentElement.classList.contains(WINDOW_SCROLL_CLASS);
}

export function getScrollRoot() {
  if (usesWindowScroll()) return null;
  return document.querySelector(SCROLL_ROOT_SELECTOR);
}

/** Prefer the element that is actually scrolling (shell body vs window). */
export function getActiveScrollElement() {
  if (usesWindowScroll()) return null;

  const body = getScrollRoot();
  if (body) {
    const canBodyScroll = body.scrollHeight > body.clientHeight + 2;
    if (canBodyScroll || body.scrollTop > 0) {
      return body;
    }
  }
  const doc = document.documentElement;
  if (doc.scrollHeight > window.innerHeight + 2 || window.scrollY > 0) {
    return null;
  }
  return body ?? null;
}

export function readScrollOffset(element = getActiveScrollElement()) {
  if (element) {
    return {
      top: element.scrollTop,
      left: element.scrollLeft,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      element,
    };
  }
  const doc = document.documentElement;
  return {
    top: window.scrollY,
    left: window.scrollX,
    clientHeight: window.innerHeight,
    scrollHeight: doc.scrollHeight,
    element: null,
  };
}

export function writeScrollTop(top, element = getActiveScrollElement()) {
  const value = Math.max(0, top);
  if (element) {
    element.scrollTop = value;
    return;
  }
  window.scrollTo({ top: value, left: 0 });
}

export function restoreScrollTop(targetTop, element = getActiveScrollElement()) {
  const saved = Math.max(0, targetTop);
  if (!saved) return;

  let attempts = 0;
  const maxAttempts = 30;

  const attempt = () => {
    const active = element ?? getActiveScrollElement();
    const { scrollHeight, clientHeight } = readScrollOffset(active);
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    const target = Math.min(saved, maxScroll);
    writeScrollTop(target, active);

    const { top } = readScrollOffset(active);
    if (attempts < maxAttempts && target > 8 && top < target - 8) {
      attempts += 1;
      requestAnimationFrame(attempt);
    }
  };

  requestAnimationFrame(attempt);
}

export function isNearScrollBottom(threshold = 96) {
  const { top, clientHeight, scrollHeight } = readScrollOffset();
  return top + clientHeight >= scrollHeight - threshold;
}

export function subscribeScroll(listener) {
  const body = getScrollRoot();
  const onScroll = () => listener();
  if (body) {
    body.addEventListener('scroll', onScroll, { passive: true });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    if (body) {
      body.removeEventListener('scroll', onScroll);
    }
    window.removeEventListener('scroll', onScroll);
  };
}

export function getScrollObservationTarget() {
  if (usesWindowScroll()) return document.documentElement;
  return getScrollRoot();
}

/** Visible scroll-preview band — below sticky chrome, above tab bar, iPad visualViewport-aware. */
export function getScrollPreviewViewport() {
  const tabEl = typeof document !== 'undefined'
    ? document.querySelector('.main-tabs')
    : null;
  const tabHeight = tabEl ? tabEl.getBoundingClientRect().height : 0;

  let chromeBottom = 0;
  if (typeof document !== 'undefined') {
    const chromeEl = document.querySelector('.source-app-chrome');
    if (chromeEl) {
      const chromeRect = chromeEl.getBoundingClientRect();
      if (chromeRect.top <= 2) {
        chromeBottom = chromeRect.bottom;
      }
    }
  }

  if (typeof window !== 'undefined' && window.visualViewport) {
    const vv = window.visualViewport;
    const bandTop = Math.max(vv.offsetTop, chromeBottom);
    const bandBottom = vv.offsetTop + vv.height - tabHeight;
    const height = Math.max(120, bandBottom - bandTop);
    return {
      top: bandTop,
      bottom: bandBottom,
      left: vv.offsetLeft,
      right: vv.offsetLeft + vv.width,
      width: vv.width,
      height,
      center: bandTop + height / 2,
    };
  }

  const width = window.innerWidth;
  const top = chromeBottom;
  const height = Math.max(120, window.innerHeight - tabHeight - top);
  return {
    top,
    bottom: top + height,
    left: 0,
    right: width,
    width,
    height,
    center: top + height / 2,
  };
}

const FULL_IN_VIEW_EPS = 2;

/** Fraction of element area visible inside the scroll-preview viewport. */
export function getElementIntersectionRatioInScrollPreviewViewport(element) {
  if (!element) return 0;
  const { top, bottom, left, right } = getScrollPreviewViewport();
  const rect = element.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return 0;

  const visibleTop = Math.max(rect.top, top);
  const visibleBottom = Math.min(rect.bottom, bottom);
  const visibleLeft = Math.max(rect.left, left);
  const visibleRight = Math.min(rect.right, right);
  const visibleWidth = visibleRight - visibleLeft;
  const visibleHeight = visibleBottom - visibleTop;
  if (visibleWidth <= 0 || visibleHeight <= 0) return 0;

  const visibleArea = visibleWidth * visibleHeight;
  const elementArea = rect.width * rect.height;
  if (elementArea <= 0) return 0;
  return visibleArea / elementArea;
}

/** True when the element has no vertical overlap with the scroll-preview viewport. */
export function isElementCompletelyOutsideScrollPreviewViewport(element) {
  if (!element) return true;
  const { top, bottom } = getScrollPreviewViewport();
  const rect = element.getBoundingClientRect();
  // Vertical feed — horizontal bounds caused false "outside" on wide tablets.
  return rect.bottom <= top + FULL_IN_VIEW_EPS
    || rect.top >= bottom - FULL_IN_VIEW_EPS;
}

/** True when the element is entirely inside the scroll-preview viewport (above tab bar). */
export function isElementFullyInScrollPreviewViewport(element) {
  if (!element) return false;
  const { top, bottom, left, right } = getScrollPreviewViewport();
  const rect = element.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return false;
  return rect.top >= top - FULL_IN_VIEW_EPS
    && rect.bottom <= bottom + FULL_IN_VIEW_EPS
    && rect.left >= left - FULL_IN_VIEW_EPS
    && rect.right <= right + FULL_IN_VIEW_EPS;
}

export function scrollStorageKey(pathname, search = '') {
  const path = pathname.replace(/\/$/, '') || '/';

  if (path.endsWith('/x') || path.endsWith('/dashboard')) {
    return `${PREFIX}:x`;
  }
  if (path.endsWith('/spankbang') || path.endsWith('/library')) {
    return `${PREFIX}:spankbang`;
  }
  return null;
}
