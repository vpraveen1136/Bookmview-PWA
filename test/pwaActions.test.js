import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
globalThis.window = {
  dispatchEvent: () => {},
  setTimeout,
};
Object.defineProperty(globalThis, 'navigator', {
  value: {},
  configurable: true,
});
globalThis.document = {
  body: {
    appendChild: () => {},
    removeChild: () => {},
  },
  createElement: () => ({
    href: '',
    download: '',
    click: () => {},
  }),
};
globalThis.URL = {
  createObjectURL: () => 'blob:test',
  revokeObjectURL: () => {},
};
if (!globalThis.File) {
  globalThis.File = class File extends Blob {
    constructor(parts, name, options) {
      super(parts, options);
      this.name = name;
    }
  };
}

const {
  applyQueuedActionsToBookmark,
  coalescePendingActions,
  enqueuePwaAction,
  exportPendingPwaActions,
  loadPwaActions,
  summarizePwaActions,
} = await import('../src/lib/pwaActions.js');

function resetActions() {
  store.clear();
}

test('coalesces archive and favourite actions independently per bookmark', () => {
  resetActions();
  enqueuePwaAction('archive', 'A');
  enqueuePwaAction('unarchive', 'A');
  enqueuePwaAction('archive', 'A');
  enqueuePwaAction('favourite', 'B');
  enqueuePwaAction('unfavourite', 'B');
  enqueuePwaAction('favourite', 'B');

  const coalesced = coalescePendingActions(loadPwaActions());
  assert.equal(coalesced.length, 2);
  assert.deepEqual(coalesced.map((action) => [action.tweetId, action.type]), [
    ['A', 'archive'],
    ['B', 'favourite'],
  ]);
});

test('export marks only coalesced pending actions as exported', async () => {
  resetActions();
  enqueuePwaAction('archive', 'A');
  enqueuePwaAction('unarchive', 'A');
  enqueuePwaAction('favourite', 'A');

  const result = await exportPendingPwaActions();
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.match(result.filename, /^pwa-actions-\d{8}-\d{6}\.json$/);
  assert.deepEqual(result.payload.actions.map((action) => action.type), ['unarchive', 'favourite']);

  const summary = summarizePwaActions(loadPwaActions());
  assert.equal(summary.pending, 0);
  assert.equal(summary.exported, 3);
});

test('queued actions overlay bookmark state', () => {
  resetActions();
  enqueuePwaAction('archive', '123');
  enqueuePwaAction('favourite', '123');

  const bookmark = applyQueuedActionsToBookmark({
    tweet_id: '123',
    is_archived: false,
    is_favorite: false,
  }, loadPwaActions());

  assert.equal(bookmark.is_archived, true);
  assert.equal(bookmark.is_favorite, true);
});
