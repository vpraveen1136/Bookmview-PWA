const STORAGE_KEY = 'bookmview.pwa.actions.v1';
const ACTION_TYPES = new Set(['archive', 'unarchive', 'favourite', 'unfavourite']);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return `${prefix}_${cryptoObj.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readActions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.tweetId && ACTION_TYPES.has(item?.type)) : [];
  } catch {
    return [];
  }
}

function writeActions(actions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  window.dispatchEvent(new Event('bookmview-pwa-actions-changed'));
}

export function loadPwaActions() {
  return readActions();
}

export function enqueuePwaAction(type, tweetId) {
  if (!ACTION_TYPES.has(type)) throw new Error(`Unsupported PWA action: ${type}`);
  const action = {
    id: randomId('act'),
    type,
    tweetId: String(tweetId),
    createdAt: nowIso(),
    status: 'pending',
  };
  writeActions([...readActions(), action]);
  return action;
}

export function coalescePendingActions(actions = readActions()) {
  const pending = actions.filter((item) => item.status === 'pending');
  const latest = new Map();
  for (const action of pending) {
    latest.set(actionQueueKey(action), action);
  }
  return [...latest.values()].sort((a, b) => (
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ));
}

function actionQueueKey(action) {
  const field = action.type === 'archive' || action.type === 'unarchive' ? 'archive' : 'favourite';
  return `${action.tweetId}::${field}`;
}

export function summarizePwaActions(actions = readActions()) {
  const pending = actions.filter((item) => item.status === 'pending');
  const exported = actions.filter((item) => item.status === 'exported');
  return {
    pending: pending.length,
    exported: exported.length,
    exportable: coalescePendingActions(actions).length,
  };
}

export function applyQueuedActionsToBookmark(bookmark, actions = readActions()) {
  if (!bookmark?.tweet_id) return bookmark;
  let next = bookmark;
  for (const action of actions) {
    if (!['pending', 'exported'].includes(action.status)) continue;
    if (String(action.tweetId) !== String(bookmark.tweet_id)) continue;
    if (action.type === 'archive') next = { ...next, is_archived: true };
    if (action.type === 'unarchive') next = { ...next, is_archived: false };
    if (action.type === 'favourite') next = { ...next, is_favorite: true };
    if (action.type === 'unfavourite') next = { ...next, is_favorite: false };
  }
  return next;
}

export function applyQueuedActionsToLibrary(library, actions = readActions()) {
  return (library || []).map((bookmark) => applyQueuedActionsToBookmark(bookmark, actions));
}

export async function exportPendingPwaActions() {
  const actions = readActions();
  const exportActions = coalescePendingActions(actions);
  if (!exportActions.length) return { ok: false, count: 0, message: 'No pending changes to export.' };

  const createdAt = nowIso();
  const exportId = randomId('exp');
  const compact = createdAt.replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const filename = `pwa-actions-${compact}.json`;
  const payload = {
    version: 1,
    exportId,
    createdAt,
    actions: exportActions.map(({ id, type, tweetId, createdAt: actionCreatedAt }) => ({
      id,
      type,
      tweetId,
      createdAt: actionCreatedAt,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: 'BookmView PWA changes',
      text: 'Copy this file to Google Drive / BookmView.',
      files: [file],
    });
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const exportedKeys = new Set(exportActions.map(actionQueueKey));
  writeActions(actions.map((action) => (
    action.status === 'pending' && exportedKeys.has(actionQueueKey(action))
      ? { ...action, status: 'exported', exportId, exportedAt: createdAt }
      : action
  )));

  return { ok: true, count: exportActions.length, filename, exportId, payload };
}
