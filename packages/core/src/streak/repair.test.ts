import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { dayRange, type DayKey } from './dayKey.ts';
import { streakFrom, type StreakCover } from './streak.ts';
import { REPAIR_MAX_GAP, REPAIR_PRACTICES, recentBreak, repairOffer } from './repair.ts';

process.env.TZ = 'Europe/Paris';

const noon = (day: DayKey, minutes = 0) => Date.parse(`${day}T10:00:00Z`) + minutes * 60_000;
const run = dayRange('2026-09-21', '2026-10-02'); // twelve days

describe('streak repair', () => {
  test('two finished practices within 48 hours bring a short gap back', () => {
    assert.equal(REPAIR_PRACTICES, 2);
    assert.equal(REPAIR_MAX_GAP, 2);
    // The 3rd got away. The streak broke as the 4th began; the 4th and 5th are the window.
    const input = { practiceDays: [...run, '2026-10-04'], covers: [] as StreakCover[], today: '2026-10-04', entitled: true };

    const one = repairOffer({ ...input, sittings: [{ at: noon('2026-10-04') }] });
    assert.deepEqual(one, {
      days: ['2026-10-03'],
      runBefore: 12,
      windowStart: '2026-10-04',
      windowEnd: '2026-10-05',
      needed: 2,
      done: 1,
      ready: false,
    });

    const two = repairOffer({ ...input, sittings: [{ at: noon('2026-10-04') }, { at: noon('2026-10-04', 30) }] });
    assert.equal(two?.ready, true);
    assert.equal(two?.done, 2);

    // Once the caller writes the repair cover, the run is whole and the count is the days practised.
    const repaired = streakFrom({ ...input, covers: two!.days.map((day) => ({ day, kind: 'repair' as const, at: 1 })) });
    assert.equal(repaired.current, 13);
    assert.deepEqual(repaired.coveredInRun, [{ day: '2026-10-03', kind: 'repair' }]);
    // And there is nothing left to repair.
    assert.equal(recentBreak({ ...input, covers: [{ day: '2026-10-03', kind: 'repair', at: 1 }] }), null);
  });

  test('the two practices may fall on either day of the window', () => {
    // One on the 4th, one on the 5th: the 4th is now part of a new run, and the gap behind it can still be repaired.
    const offer = repairOffer({
      practiceDays: [...run, '2026-10-04', '2026-10-05'],
      covers: [],
      today: '2026-10-05',
      entitled: true,
      sittings: [{ at: noon('2026-10-04') }, { at: noon('2026-10-05') }],
    });
    assert.equal(offer?.ready, true);
    assert.deepEqual(offer?.days, ['2026-10-03']);
  });

  test('a two-day gap leaves one day of window, and three days is past repair', () => {
    // The 3rd and 4th got away; the window is the 4th and 5th, so only the 5th can hold practice.
    const twoDay = repairOffer({ practiceDays: [...run, '2026-10-05'], covers: [], today: '2026-10-05', entitled: true, sittings: [] });
    assert.deepEqual(twoDay && { days: twoDay.days, windowEnd: twoDay.windowEnd }, { days: ['2026-10-03', '2026-10-04'], windowEnd: '2026-10-05' });

    const threeDay = { practiceDays: [...run, '2026-10-06'], covers: [] as StreakCover[], today: '2026-10-06', entitled: true };
    assert.equal(repairOffer({ ...threeDay, sittings: [{ at: noon('2026-10-06') }, { at: noon('2026-10-06', 9) }] }), null);
    assert.equal(recentBreak(threeDay), null);
  });

  test('the window closes, and practice outside it does not count', () => {
    // Back on the 6th after a one-day gap on the 3rd: the window was the 4th and 5th.
    const late = { practiceDays: [...run, '2026-10-04', '2026-10-05', '2026-10-06'], covers: [] as StreakCover[], today: '2026-10-06', entitled: true };
    assert.equal(repairOffer({ ...late, sittings: [{ at: noon('2026-10-06') }, { at: noon('2026-10-06', 5) }] }), null);

    // Inside the window, practice before the break or in the future is not counted.
    const offer = repairOffer({
      practiceDays: [...run, '2026-10-04'],
      covers: [],
      today: '2026-10-04',
      entitled: true,
      sittings: [{ at: noon('2026-10-02') }, { at: noon('2026-10-05') }, { at: noon('2026-10-04') }],
    });
    assert.equal(offer?.done, 1);
    assert.equal(offer?.ready, false);
  });

  test('there is nothing to repair without a run before the gap', () => {
    assert.equal(recentBreak({ practiceDays: [], covers: [], today: '2026-10-04' }), null);
    assert.equal(recentBreak({ practiceDays: ['2026-10-04'], covers: [], today: '2026-10-04' }), null);
    // A run that is still alive has no break.
    assert.equal(recentBreak({ practiceDays: run, covers: [], today: '2026-10-03' }), null);
  });
});
