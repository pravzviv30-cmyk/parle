/**
 * Board A moments 2, 4 and 5 (founder, 2026-11-19): what a settle may say about
 * a freeze that carried the run, a repair that brought it back and a freeze
 * this sitting banked. Each is read off facts on disk after the write, and each
 * test names a way it could lie.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, streakFrom, type StreakCover } from '@luvani/core';

import { bankedNow, carriedNow, repairedNow } from './delta.ts';

const TODAY = '2026-10-07';
const AT = new Date(2026, 9, 7, 12).getTime();
const HOUR = 3_600_000;
const days = (...back: number[]): string[] => back.map((n) => addDays(TODAY, -n));
const cover = (n: number, kind: StreakCover['kind'], at = 1): StreakCover => ({ day: addDays(TODAY, -n), kind, at });

describe('a run a freeze carried (moment 2)', () => {
  const before = streakFrom({ practiceDays: days(5, 4, 3, 2), covers: [cover(1, 'freeze')], today: TODAY });
  const after = streakFrom({ practiceDays: [...days(5, 4, 3, 2), TODAY], covers: [cover(1, 'freeze')], today: TODAY });

  test('the first practice after a freeze-covered day is carried, whoever wrote the freeze', () => {
    assert.equal(carriedNow(before, after, true, null), true);
  });

  test('a practice that was not the day\'s first is never carried', () => {
    assert.equal(carriedNow(before, after, false, null), false);
  });

  test('a repair takes its own moment, never this one', () => {
    assert.equal(carriedNow(before, after, true, { day: addDays(TODAY, -1), runBefore: 4 }), false);
  });

  test('a travel cover does not count as a freeze', () => {
    const travelled = streakFrom({ practiceDays: [...days(5, 4, 3, 2), TODAY], covers: [cover(1, 'travel')], today: TODAY });
    assert.equal(carriedNow(before, travelled, true, null), false);
  });

  test('a refunded freeze (its day turned out practised) carries nothing', () => {
    const practised = streakFrom({ practiceDays: [...days(5, 4, 3, 2, 1), TODAY], covers: [cover(1, 'freeze')], today: TODAY });
    const was = streakFrom({ practiceDays: days(5, 4, 3, 2, 1), covers: [cover(1, 'freeze')], today: TODAY });
    assert.equal(carriedNow(was, practised, true, null), false);
  });

  test('a freeze from before the last practice is old news', () => {
    const was = streakFrom({ practiceDays: days(5, 3, 2, 1), covers: [cover(4, 'freeze')], today: TODAY });
    const now = streakFrom({ practiceDays: [...days(5, 3, 2, 1), TODAY], covers: [cover(4, 'freeze')], today: TODAY });
    assert.equal(carriedNow(was, now, true, null), false);
  });
});

describe('a repair that brought the streak back (moment 4)', () => {
  const offer = { days: [addDays(TODAY, -2)], runBefore: 10, windowStart: addDays(TODAY, -1), windowEnd: TODAY, needed: 2, done: 1, ready: false };
  const repair = cover(2, 'repair', 50);

  test('a repair the run kept names its day and the number the Streak screen promised', () => {
    const after = streakFrom({ practiceDays: [...days(12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 1), TODAY], covers: [repair], today: TODAY });
    assert.deepEqual(repairedNow([repair], after, offer), { day: addDays(TODAY, -2), runBefore: 10 });
  });

  test('a repair the run did not keep (another phone froze the day first) is not one', () => {
    const after = streakFrom({ practiceDays: [...days(12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 1), TODAY], covers: [cover(2, 'freeze', 10), repair], today: TODAY });
    assert.equal(after.coveredInRun[0]!.kind, 'freeze');
    assert.equal(repairedNow([repair], after, offer), null);
  });

  test('no repair written, or no promised number, is no repair moment', () => {
    const after = streakFrom({ practiceDays: [...days(12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 1), TODAY], covers: [repair], today: TODAY });
    assert.equal(repairedNow([], after, offer), null);
    assert.equal(repairedNow([repair], after, null), null);
  });
});

describe('a freeze this sitting banked (moment 5)', () => {
  const earlier = { at: AT - 2 * HOUR };
  const own = { at: AT };
  const base = { source: 'drill' as const, at: AT, day: TODAY, beforeSittings: [earlier], afterSittings: [earlier, own], beforeBanked: false, afterBanked: true, afterBankDays: [TODAY] };

  test('the second sitting of the day, read back as banked, banked it', () => {
    assert.equal(bankedNow(base), true);
  });

  test('an unsaved write (this sitting not on disk) banks nothing', () => {
    assert.equal(bankedNow({ ...base, afterSittings: [earlier, { at: AT - HOUR }] }), false);
  });

  test('a bank another phone made is not this sitting\'s', () => {
    const tablet = [{ at: AT - 3 * HOUR }, { at: AT - HOUR }];
    assert.equal(bankedNow({ ...base, beforeSittings: [], afterSittings: [...tablet, own] }), false, 'two sittings synced in mid-sitting');
    assert.equal(bankedNow({ ...base, beforeSittings: tablet, afterSittings: [...tablet, own] }), false, 'the snapshot already held two');
    assert.equal(bankedNow({ ...base, beforeBanked: true }), false, 'the bank was already full');
  });

  test('never predicted: the bank must read back, on this day', () => {
    assert.equal(bankedNow({ ...base, afterBanked: false }), false);
    assert.equal(bankedNow({ ...base, afterBankDays: [] }), false);
  });

  test('a guest never banks', () => {
    assert.equal(bankedNow({ ...base, source: 'guest' }), false);
  });
});
