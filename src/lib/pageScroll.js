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
