import { useEffect, useState } from 'react';

import {
  enqueuePwaAction,
  exportPendingPwaActions,
  loadPwaActions,
  summarizePwaActions,
} from '../lib/pwaActions.js';

export function usePwaActions() {
  const [actions, setActions] = useState(() => loadPwaActions());
  const summary = summarizePwaActions(actions);

  useEffect(() => {
    const refresh = () => setActions(loadPwaActions());
    window.addEventListener('bookmview-pwa-actions-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('bookmview-pwa-actions-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const enqueue = (type, tweetId) => {
    const action = enqueuePwaAction(type, tweetId);
    setActions(loadPwaActions());
    return action;
  };

  const exportChanges = async () => {
    const result = await exportPendingPwaActions();
    setActions(loadPwaActions());
    return result;
  };

  return {
    actions,
    summary,
    enqueue,
    exportChanges,
  };
}
