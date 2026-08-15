import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeScroll } from '../lib/pageScroll.js';

/**
 * Tracks the grid card whose center is closest to the viewport center while scrolling.
 */
export function useCenterScrollPreview(itemIds) {
  const [focusedId, setFocusedId] = useState(null);
  const cardRefs = useRef(new Map());
  const rafRef = useRef(null);
  const measureQueuedRef = useRef(false);

  const registerCardRef = useCallback((id, element) => {
    if (element) {
      cardRefs.current.set(id, element);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  const measure = useCallback(() => {
    const viewportCenter = window.innerHeight / 2;
    let bestId = null;
    let bestDistance = Infinity;

    for (const id of itemIds) {
      const element = cardRefs.current.get(id);
      if (!element) continue;

      const rect = element.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;

      const cardCenter = rect.top + rect.height / 2;
      const distance = Math.abs(cardCenter - viewportCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    }

    setFocusedId((prev) => (prev === bestId ? prev : bestId));
  }, [itemIds]);

  const scheduleMeasure = useCallback(() => {
    if (measureQueuedRef.current) return;
    measureQueuedRef.current = true;
    rafRef.current = requestAnimationFrame(() => {
      measureQueuedRef.current = false;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    scheduleMeasure();
    const unsub = subscribeScroll(scheduleMeasure);
    const onResize = () => scheduleMeasure();
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      unsub();
      window.removeEventListener('resize', onResize);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [scheduleMeasure]);

  useEffect(() => {
    scheduleMeasure();
  }, [itemIds, scheduleMeasure]);

  return { focusedId, registerCardRef };
}
