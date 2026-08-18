import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildPath, authoredPhraseKeys, AUTHORED_PATH } from './path.ts';
import { DRILL_FIXTURES } from '../drill/fixtures.ts';
import type { ReviewCard } from '../review/scheduler.ts';

const NOW = new Date(2026, 0, 15, 12).getTime();
const DAY = 86_400_000;

function card(id: string, due: number, reps = 2): ReviewCard {
  return { id, kind: 'turn', front: id, back: id, context: '', ipa: '', addedAt: NOW - 30 * DAY, due, reps, ease: 2.5, intervalDays: 3, lapses: 0 };
}

const OPTS = { lessonDone: false };

describe('the authored graph', () => {
  test('every fixture phrase lands in exactly one node', () => {
    // The guard that stops a new fixture being silently orphaned: added to the
    // bank, drilled by the deck, and invisible on the map.
    const authored = authoredPhraseKeys();
    const fixtureKeys = [...new Set(DRILL_FIXTURES.map((e) => e.phraseKey))];
    for (const key of fixtureKeys) {
      const homes = authored.filter((k) => k === key);
      assert.equal(homes.length, 1, `${key} should appear in exactly one node, found ${homes.length}`);
    }
  });

  test('no node claims a phrase the bank cannot drill', () => {
    const fixtureKeys = new Set(DRILL_FIXTURES.map((e) => e.phraseKey));
    for (const key of authoredPhraseKeys()) {
      assert.ok(fixtureKeys.has(key), `${key} is on the path but nothing drills it`);
    }
  });

  test('node ids are unique', () => {
    const ids = AUTHORED_PATH.flatMap((u) => u.nodes.map((n) => n.id));
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('node state follows the deck, not a second store', () => {
  test('an untouched node is available', () => {
    const units = buildPath([], [], OPTS, NOW);
    assert.equal(units[0]!.nodes[1]!.state, 'available');
  });

  test('some phrases known makes a node in-progress', () => {
    const units = buildPath([card('phrase:je vais prendre un croissant', NOW + DAY)], [], OPTS, NOW);
    const order = units[0]!.nodes.find((n) => n.id === 'cafe:order')!;
    assert.equal(order.state, 'in-progress');
  });

  test('all phrases known and nothing due is complete', () => {
    const deck = ["phrase:sur place, s'il vous plaît", 'phrase:je vais prendre un croissant', "phrase:oui, c'est tout, merci", 'phrase:ça sera tout, merci'].map((k) => card(k, NOW + DAY));
    const units = buildPath(deck, [], OPTS, NOW);
    assert.equal(units[0]!.nodes.find((n) => n.id === 'cafe:order')!.state, 'complete');
  });

  test('a completed node returns to needs-review when the scheduler wants it', () => {
    // Deliberately not how the reference design behaves: the deck stays the
    // single source of truth, so a node can come back.
    const deck = ["phrase:sur place, s'il vous plaît", 'phrase:je vais prendre un croissant', "phrase:oui, c'est tout, merci", 'phrase:ça sera tout, merci'].map((k) => card(k, NOW - DAY));
    const units = buildPath(deck, [], OPTS, NOW);
    const order = units[0]!.nodes.find((n) => n.id === 'cafe:order')!;
    // Both true at once, which is the point of keeping them apart.
    assert.equal(order.state, 'needs-review');
    assert.equal(order.isNext, true);
  });

  test('the guided lesson completes on having been finished, not on the deck', () => {
    const undone = buildPath([], [], { lessonDone: false }, NOW);
    const done = buildPath([], [], { lessonDone: true }, NOW);
    assert.notEqual(undone[0]!.nodes[0]!.state, 'complete');
    assert.equal(done[0]!.nodes[0]!.state, 'complete');
  });
});

describe('gating', () => {
  test('only the tutor-written node ever locks', () => {
    const units = buildPath([], [], OPTS, NOW);
    const locked = units.flatMap((u) => u.nodes).filter((n) => n.state === 'locked');
    assert.equal(locked.length, 1);
    assert.equal(locked[0]!.kind, 'mine');
  });

  test('every authored node is open from the very first launch', () => {
    // Principle 1: support is withdrawn as the learner improves, never
    // withheld until they earn it.
    const units = buildPath([], [], OPTS, NOW);
    const authored = units.flatMap((u) => u.nodes).filter((n) => n.kind !== 'mine');
    assert.ok(authored.every((n) => n.state !== 'locked'));
  });

  test('the tutor-written node unlocks once the tutor has written something', () => {
    const bank = [{ ...DRILL_FIXTURES[0]!, id: 'gen:abc', phraseKey: 'phrase:mine' }];
    const units = buildPath([], bank, OPTS, NOW);
    const mine = units.flatMap((u) => u.nodes).find((n) => n.kind === 'mine')!;
    assert.notEqual(mine.state, 'locked');
  });
});

describe('exactly one next', () => {
  test('there is never more than one primary action on the map', () => {
    for (const deck of [[], [card('phrase:salut ! ça va ?', NOW - DAY)], [card('phrase:merci beaucoup', NOW + DAY)]]) {
      const units = buildPath(deck, [], OPTS, NOW);
      const next = units.flatMap((u) => u.nodes).filter((n) => n.isNext);
      assert.equal(next.length, 1, 'exactly one node should carry the action');
    }
  });

  test('something the scheduler wants back outranks new ground', () => {
    const deck = ['phrase:salut ! ça va ?', 'phrase:ça marche', 'phrase:carrément !'].map((k) => card(k, NOW - DAY));
    const units = buildPath(deck, [], OPTS, NOW);
    const next = units.flatMap((u) => u.nodes).find((n) => n.isNext)!;
    assert.equal(next.id, 'amis:greet');
  });

  test('a fully finished path offers nothing rather than inventing something', () => {
    const deck = authoredPhraseKeys().map((k) => card(k, NOW + 10 * DAY));
    const units = buildPath(deck, [], { lessonDone: true }, NOW);
    const next = units.flatMap((u) => u.nodes).filter((n) => n.isNext);
    assert.equal(next.length, 0);
  });
});
