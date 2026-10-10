import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createEntranceReceipts, createEntranceSession, STREAK_ENTRANCE_MS, STREAK_ENTRANCE_TIMELINE, streakEntranceDuration } from './streakEntrance.ts';

/** The linear interpolation used by the screen's shared elapsed-time value. */
function valueAt(elapsed: number, { inputRange, outputRange }: { inputRange: number[]; outputRange: number[] }): number {
  for (let index = 1; index < inputRange.length; index += 1) {
    if (elapsed <= inputRange[index]!) {
      const ratio = (elapsed - inputRange[index - 1]!) / (inputRange[index]! - inputRange[index - 1]!);
      return outputRange[index - 1]! + ratio * (outputRange[index]! - outputRange[index - 1]!);
    }
  }
  return outputRange.at(-1)!;
}

describe('the streak entrance event and coordinated timeline', () => {
  test('only a moment for the authoritative achievement can start, and ordinary page visits do not consume it', () => {
    const receipts = createEntranceReceipts();
    const event = 'streak:2026-10-10';
    assert.equal(receipts.claim(event, null), false);
    assert.equal(receipts.claim(event, 'streak:2026-10-09'), false);
    assert.equal(receipts.claim('', ''), false);
    assert.equal(receipts.claim(event, event), true);
  });

  test('repeated renders, reopening, skipping and backgrounding cannot reclaim the same moment', () => {
    const receipts = createEntranceReceipts();
    const event = 'streak:2026-10-10';
    assert.equal(receipts.claim(event, event), true);
    for (const _reason of ['rerender', 'reopen', 'skip', 'background', 'completion']) assert.equal(receipts.claim(event, event), false);
    assert.equal(receipts.claim('streak:2026-10-11', 'streak:2026-10-11'), true, 'a new qualifying day was swallowed');
    assert.equal(receipts.claim(event, event), false, 'claiming a newer day forgot an older receipt');
  });

  test('claiming while motion is reduced also prevents a later setting change from replaying the event', () => {
    const receipts = createEntranceReceipts();
    const event = 'streak:2026-10-10';
    const claimedWhileReduced = receipts.claim(event, event);
    const reduced = true;
    assert.equal(claimedWhileReduced && !reduced, false);
    assert.equal(receipts.claim(event, event), false, 'turning motion on replayed an already presented achievement');
  });

  test('the hero never changes position visibly and its complete central message holds long enough to read', () => {
    const timeline = STREAK_ENTRANCE_TIMELINE;
    let readableHold = 0;
    for (let elapsed = 0; elapsed <= STREAK_ENTRANCE_MS; elapsed += 1) {
      const flame = valueAt(elapsed, timeline.flame);
      const message = valueAt(elapsed, timeline.message);
      const position = valueAt(elapsed, timeline.position);
      if (position > 0 && position < 1) {
        assert.equal(flame, 0, 'the flame travelled across the screen while visible');
        assert.equal(message, 0, 'the message travelled across the screen while visible');
      }
      if (position === 0 && flame === 1 && message === 1) readableHold += 1;
      assert.ok(flame >= 0 && flame <= 1 && message >= 0 && message <= 1);
    }
    assert.ok(readableHold >= 700, 'the central message disappeared before it could be read');
    assert.equal(valueAt(0, timeline.support), 0, 'supporting content competes with the central introduction');
    assert.equal(valueAt(STREAK_ENTRANCE_MS, timeline.flame), 1);
    assert.equal(valueAt(STREAK_ENTRANCE_MS, timeline.message), 1);
    assert.equal(valueAt(STREAK_ENTRANCE_MS, timeline.position), 1);
    assert.equal(valueAt(STREAK_ENTRANCE_MS, timeline.support), 1);
  });

  test('daily updates have a shorter duration than the first day and named milestones', () => {
    assert.equal(streakEntranceDuration('daily'), 1200);
    assert.equal(streakEntranceDuration('first'), STREAK_ENTRANCE_MS);
    assert.equal(streakEntranceDuration('milestone'), STREAK_ENTRANCE_MS);
    assert.ok(STREAK_ENTRANCE_MS >= 1900 && STREAK_ENTRANCE_MS <= 2300);
  });

  test('an early skip is terminal while both accessibility reads are pending, and reopening has no blank introduction', () => {
    const receipts = createEntranceReceipts();
    const event = 'streak:2026-10-10';
    const entrance = createEntranceSession(receipts, event, event);
    assert.equal(entrance.phase, 'waiting');
    assert.deepEqual(entrance.update({ active: true, foreground: true, reduced: null, reader: null }), { phase: 'waiting', celebrate: false, animate: false });
    entrance.settle();
    assert.equal(entrance.phase, 'settled');
    assert.deepEqual(entrance.update({ active: true, foreground: true, reduced: false, reader: false }), { phase: 'settled', celebrate: false, animate: false });
    assert.equal(createEntranceSession(receipts, event, event).phase, 'settled');
  });

  test('backgrounding before preference reads resolve consumes the event and foregrounding never restarts it', () => {
    const receipts = createEntranceReceipts();
    const event = 'streak:2026-10-10';
    const entrance = createEntranceSession(receipts, event, event);
    assert.deepEqual(entrance.update({ active: true, foreground: false, reduced: null, reader: null }), { phase: 'settled', celebrate: false, animate: false });
    assert.deepEqual(entrance.update({ active: true, foreground: true, reduced: false, reader: false }), { phase: 'settled', celebrate: false, animate: false });
    assert.equal(receipts.has(event), true);
  });

  test('reduced motion or a screen reader settles immediately even if the other preference is pending', () => {
    for (const pending of [{ reduced: true, reader: null }, { reduced: null, reader: true }] as const) {
      const receipts = createEntranceReceipts();
      const event = 'streak:2026-10-10';
      const entrance = createEntranceSession(receipts, event, event);
      assert.deepEqual(entrance.update({ active: true, foreground: true, ...pending }), { phase: 'settled', celebrate: true, animate: false });
      assert.deepEqual(entrance.update({ active: true, foreground: true, reduced: false, reader: false }), { phase: 'settled', celebrate: false, animate: false });
      assert.equal(createEntranceSession(receipts, event, event).phase, 'settled');
    }
  });

  test('a visible fresh event starts once, then hiding or completing the screen settles permanently', () => {
    for (const end of ['hide', 'complete'] as const) {
      const receipts = createEntranceReceipts();
      const event = 'streak:2026-10-10';
      const entrance = createEntranceSession(receipts, event, event);
      const ready = { active: true, foreground: true, reduced: false, reader: false };
      assert.deepEqual(entrance.update(ready), { phase: 'introducing', celebrate: true, animate: true });
      assert.deepEqual(entrance.update(ready), { phase: 'introducing', celebrate: false, animate: false });
      if (end === 'hide') assert.deepEqual(entrance.update({ ...ready, active: false }), { phase: 'settled', celebrate: false, animate: false });
      else entrance.settle();
      assert.deepEqual(entrance.update(ready), { phase: 'settled', celebrate: false, animate: false });
    }
  });
});
