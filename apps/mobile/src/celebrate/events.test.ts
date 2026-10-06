import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachCelebrationListener,
  celebrationKey,
  discardBufferedCelebrations,
  isDaySeenKey,
  isTakeover,
  MAX_TAKEOVERS,
  publishCelebrations,
  TAKEOVER_ORDER,
  takeoverRank,
  type CelebrationEvent,
} from './events.ts';

function streak(day: string, current: number): CelebrationEvent {
  return { type: 'streak-extended', key: celebrationKey.streak(day), origin: 'account', at: 0, data: { day, current, lifetimeDays: current } };
}

describe('celebration events — the contract between a fact and a moment', () => {
  test('the same fact always names the same celebration key', () => {
    assert.equal(celebrationKey.streak('2026-10-06'), 'streak:2026-10-06');
    assert.equal(celebrationKey.milestone(7, '2026-09-30'), 'milestone:7:2026-09-30');
    assert.equal(celebrationKey.level(4), 'level:4');
    assert.equal(celebrationKey.badge('streak-7'), 'badge:streak-7');
    assert.equal(celebrationKey.chest('2026-10-06'), 'chest:2026-10-06');
    assert.equal(celebrationKey.purchase('tx-1'), 'purchase:tx-1');
    assert.equal(celebrationKey.saved('p-1'), 'saved:p-1');
    assert.equal(celebrationKey.streak('2026-10-06'), celebrationKey.streak('2026-10-06'), 'a key that changed between devices would replay the moment');
  });

  test('takeovers play a purchase first, then the streak, the chest, the level and the badges, three at most', () => {
    assert.deepEqual([...TAKEOVER_ORDER], ['purchase-confirmed', 'streak-milestone', 'streak-extended', 'quest-chest', 'level-up', 'badge-earned']);
    assert.ok(takeoverRank('streak-milestone') < takeoverRank('streak-extended'), 'a milestone replaces the same day\'s plain streak moment, so it ranks first');
    assert.ok(takeoverRank('quest-chest') < takeoverRank('level-up'));
    assert.ok(takeoverRank('level-up') < takeoverRank('badge-earned'));
    assert.equal(MAX_TAKEOVERS, 3, 'README Part 6: at most three full-screen moments after one sitting');
    assert.equal(isTakeover('phrase-saved'), false, 'a saved phrase is a toast, never a takeover');
    assert.equal(isTakeover('level-up'), true);
  });

  test('streak and chest moments are kept for sixty days; milestones, levels, badges and purchases never replay', () => {
    assert.equal(isDaySeenKey(celebrationKey.streak('2026-10-06')), true);
    assert.equal(isDaySeenKey(celebrationKey.chest('2026-10-06')), true);
    assert.equal(isDaySeenKey(celebrationKey.milestone(30, '2026-09-01')), false);
    assert.equal(isDaySeenKey(celebrationKey.level(10)), false);
    assert.equal(isDaySeenKey(celebrationKey.badge('first-conversation')), false);
    assert.equal(isDaySeenKey(celebrationKey.purchase('tx-9')), false);
  });

  test('a moment published before the host mounts waits for it, and only the newest thirty-two wait', () => {
    discardBufferedCelebrations();
    publishCelebrations([]);
    for (let i = 0; i < 40; i += 1) publishCelebrations([streak(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`, i)]);
    const received: CelebrationEvent[] = [];
    const detach = attachCelebrationListener((events) => received.push(...events));
    assert.equal(received.length, 32, 'the buffer is bounded so a host that never mounts cannot grow it');
    assert.equal((received[0]!.data as { current: number }).current, 8, 'the oldest moments are the ones dropped');
    publishCelebrations([streak('2026-02-01', 99)]);
    assert.equal(received.length, 33, 'an attached host hears new moments at once');
    detach();
    publishCelebrations([streak('2026-02-02', 100)]);
    assert.equal(received.length, 33, 'a detached host hears nothing more');
    const later: CelebrationEvent[] = [];
    attachCelebrationListener((events) => later.push(...events))();
    assert.equal(later.length, 1, 'what arrived while no host listened waits for the next one');
    discardBufferedCelebrations();
  });

  test('detaching an old host never silences the one that replaced it', () => {
    discardBufferedCelebrations();
    const first: CelebrationEvent[] = [];
    const second: CelebrationEvent[] = [];
    const detachFirst = attachCelebrationListener((events) => first.push(...events));
    const detachSecond = attachCelebrationListener((events) => second.push(...events));
    detachFirst();
    publishCelebrations([streak('2026-03-01', 1)]);
    assert.equal(second.length, 1);
    assert.equal(first.length, 0);
    detachSecond();
    discardBufferedCelebrations();
  });
});
