/**
 * Node smoke tests for playability queue ordering / concurrency / network pause.
 * Run: node mobile-pwa/scripts/test-playability-queue.mjs
 */
import assert from 'node:assert/strict';
import {
  createPlayabilityQueue,
  playableIdsInLibraryOrder,
  PLAYABILITY,
} from '../src/lib/playabilityQueue.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testOrderingIgnoresCompletionOrder() {
  const order = ['A', 'B', 'C', 'D'];
  const completion = { D: 10, C: 20, A: 30, B: 40 };
  const probe = async (bookmark) => {
    await delay(completion[bookmark.tweet_id]);
    return 'playable';
  };

  const queue = createPlayabilityQueue({ concurrency: 4, probe });
  const snaps = [];
  queue.subscribe((s) => snaps.push(s.playableIds.join(',')));
  queue.reset(order.map((tweet_id) => ({ tweet_id, hls_manifest_url: 'https://x.test/a.m3u8' })));

  await delay(120);
  const final = queue.getPlayableIds();
  assert.deepEqual(final, ['A', 'B', 'C', 'D']);
  assert.deepEqual(
    playableIdsInLibraryOrder(order, Object.fromEntries(final.map((id) => [id, PLAYABILITY.PLAYABLE]))),
    ['A', 'B', 'C', 'D'],
  );
  queue.stop();
}

async function testNonPlayableSkipped() {
  const probe = async (bookmark) => (
    ['A', 'D'].includes(bookmark.tweet_id) ? 'playable' : 'non_playable'
  );
  const queue = createPlayabilityQueue({ concurrency: 3, probe });
  queue.reset(['A', 'B', 'C', 'D'].map((tweet_id) => ({
    tweet_id,
    hls_manifest_url: 'https://x.test/a.m3u8',
  })));
  await delay(80);
  assert.deepEqual(queue.getPlayableIds(), ['A', 'D']);
  queue.stop();
}

async function testNoDuplicateConcurrentChecks() {
  const inFlight = new Set();
  let maxInFlight = 0;
  const probe = async (bookmark) => {
    const id = bookmark.tweet_id;
    assert.equal(inFlight.has(id), false, `duplicate probe for ${id}`);
    inFlight.add(id);
    maxInFlight = Math.max(maxInFlight, inFlight.size);
    await delay(30);
    inFlight.delete(id);
    return 'playable';
  };
  const queue = createPlayabilityQueue({ concurrency: 4, probe });
  queue.reset(Array.from({ length: 12 }, (_, i) => ({
    tweet_id: `v${i}`,
    hls_manifest_url: 'https://x.test/a.m3u8',
  })));
  await delay(250);
  assert.ok(maxInFlight <= 4);
  assert.equal(queue.getPlayableIds().length, 12);
  queue.stop();
}

async function testFocusPrioritizesNeighborhood() {
  const started = [];
  const probe = async (bookmark) => {
    started.push(bookmark.tweet_id);
    await delay(25);
    return 'playable';
  };
  const queue = createPlayabilityQueue({ concurrency: 1, probe });
  const library = Array.from({ length: 80 }, (_, i) => ({
    tweet_id: `v${i}`,
    hls_manifest_url: 'https://x.test/a.m3u8',
  }));
  queue.reset(library);
  queue.setFocus('v50');
  await delay(40);
  const afterFocus = [];
  const unsub = queue.subscribe(() => {});
  // Collect ids started after focus had a chance to apply.
  const baseline = started.length;
  await delay(220);
  unsub();
  const windowed = started.slice(baseline, baseline + 6);
  assert.ok(
    windowed.some((id) => {
      const n = Number(String(id).slice(1));
      return n >= 50 && n <= 55;
    }),
    `expected near-focus ids, got ${windowed.join(',')}`,
  );
  queue.stop();
}

async function testExpiredRemoval() {
  const probe = async () => 'playable';
  const queue = createPlayabilityQueue({ concurrency: 2, probe });
  queue.reset(['A', 'B', 'C'].map((tweet_id) => ({
    tweet_id,
    hls_manifest_url: 'https://x.test/a.m3u8',
  })));
  await delay(80);
  assert.deepEqual(queue.getPlayableIds(), ['A', 'B', 'C']);
  queue.markExpired('B');
  assert.deepEqual(queue.getPlayableIds(), ['A', 'C']);
  queue.stop();
}

async function testNetworkErrorDoesNotMarkNonPlayable() {
  let attempts = 0;
  const probe = async () => {
    attempts += 1;
    if (attempts < 3) return 'network_error';
    return 'playable';
  };
  const queue = createPlayabilityQueue({ concurrency: 1, probe, networkRetryMs: 50 });
  queue.reset([{ tweet_id: 'A', hls_manifest_url: 'https://x.test/a.m3u8' }]);
  await delay(30);
  assert.equal(queue.getStatus('A'), PLAYABILITY.UNKNOWN);
  await delay(250);
  assert.equal(queue.getStatus('A'), PLAYABILITY.PLAYABLE);
  assert.ok(attempts >= 3);
  queue.stop();
}

async function testCapPauseAndExtend() {
  let probeCount = 0;
  const probe = async () => {
    probeCount += 1;
    await delay(8);
    return 'playable';
  };
  const queue = createPlayabilityQueue({
    concurrency: 2,
    probe,
    initialCap: 3,
    extendBatch: 2,
  });
  queue.reset(Array.from({ length: 20 }, (_, i) => ({
    tweet_id: `v${i}`,
    hls_manifest_url: 'https://x.test/a.m3u8',
  })));
  await delay(200);
  assert.equal(queue.getPlayableIds().length, 3);
  assert.equal(queue.getSnapshot().capPaused, true);
  assert.equal(queue.getSnapshot().busy, false);

  queue.extendPlayableCap(2);
  await delay(120);
  assert.equal(queue.getPlayableIds().length, 5);
  assert.equal(queue.getSnapshot().capPaused, true);
  queue.stop();
}

async function main() {
  await testOrderingIgnoresCompletionOrder();
  await testNonPlayableSkipped();
  await testNoDuplicateConcurrentChecks();
  await testFocusPrioritizesNeighborhood();
  await testExpiredRemoval();
  await testNetworkErrorDoesNotMarkNonPlayable();
  await testCapPauseAndExtend();
  console.log('playability queue tests: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
