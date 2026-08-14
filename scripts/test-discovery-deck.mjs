/**
 * Node smoke tests for discovery deck ordering.
 * Run: node mobile-pwa/scripts/test-discovery-deck.mjs
 */
import assert from 'node:assert/strict';
import {
  orderPlayablesByDeck,
  orderPlayablesDiscovery,
  reconcileDeckOrder,
  shuffleIds,
  sortLibraryByDeckOrder,
} from '../src/lib/discoveryDeck.js';

function testDeckOrderStableInsert() {
  const deck = ['A', 'F', 'X', 'M', 'B', 'Q', 'C', 'Z'];
  const playables = ['A', 'M', 'C'];
  assert.deepEqual(orderPlayablesByDeck(playables, deck), ['A', 'M', 'C']);

  const withX = ['A', 'M', 'C', 'X'];
  assert.deepEqual(orderPlayablesByDeck(withX, deck), ['A', 'X', 'M', 'C']);
}

function testDiscoveryUnseenFirst() {
  const deck = ['A', 'X', 'M', 'C'];
  const playables = ['A', 'M', 'C', 'X'];
  const seen = new Set(['A']);
  assert.deepEqual(
    orderPlayablesDiscovery(playables, deck, seen),
    ['X', 'M', 'C', 'A'],
  );
}

function testShuffleDoesNotReshuffleOnReconcile() {
  const deck = ['D', 'B', 'A', 'C'];
  const eligible = ['A', 'B', 'C', 'D'];
  assert.deepEqual(reconcileDeckOrder(deck, eligible), ['D', 'B', 'A', 'C']);
}

function testSortLibraryByDeck() {
  const library = [
    { tweet_id: 'A' },
    { tweet_id: 'B' },
    { tweet_id: 'C' },
  ];
  const sorted = sortLibraryByDeckOrder(library, ['C', 'A', 'B']);
  assert.deepEqual(sorted.map((i) => i.tweet_id), ['C', 'A', 'B']);
}

function testShuffleIdsPermutation() {
  const input = ['a', 'b', 'c', 'd'];
  const out = shuffleIds(input, () => 0);
  assert.deepEqual(out.sort(), input.sort());
}

testDeckOrderStableInsert();
testDiscoveryUnseenFirst();
testShuffleDoesNotReshuffleOnReconcile();
testSortLibraryByDeck();
testShuffleIdsPermutation();
console.log('discovery-deck tests passed');
