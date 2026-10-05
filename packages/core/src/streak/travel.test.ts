import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { dayRange } from './dayKey.ts';
import type { StreakCover } from './streak.ts';
import { TRAVEL_EVERY_DAYS, TRAVEL_OFFSET_MINUTES, travelCover } from './travel.ts';

const run = dayRange('2026-10-01', '2026-10-03');

describe('the travel cover', () => {
  test('a one-day gap after a big clock change is covered for travel', () => {
    // A twelve-hour clock change (Paris at UTC+2 in early October, Honolulu at UTC-10)
    // beside a one-day gap. That flight skips no date; a flight west across the date
    // line, Honolulu to Tokyo, does. The rule only compares the two offsets, so the
    // gap is covered either way.
    const day = travelCover({
      practiceDays: [...run, '2026-10-05'],
      covers: [],
      today: '2026-10-05',
      entitled: true,
      offsetBefore: 120,
      offsetNow: -600,
    });
    assert.equal(day, '2026-10-04');
    assert.equal(TRAVEL_OFFSET_MINUTES, 180);
  });

  test('a small clock change, a longer gap or a second trip within a week covers nothing', () => {
    const base = { practiceDays: [...run, '2026-10-05'], covers: [] as StreakCover[], today: '2026-10-05', entitled: true };
    assert.equal(travelCover({ ...base, offsetBefore: 120, offsetNow: 0 }), null, 'two hours is not travel enough');
    assert.equal(travelCover({ ...base, offsetBefore: 120, offsetNow: -60 }), '2026-10-04', 'three hours is');
    assert.equal(travelCover({ ...base, offsetBefore: null, offsetNow: -600 }), null, 'no earlier offset, no comparison');
    assert.equal(
      travelCover({ ...base, practiceDays: [...run, '2026-10-06'], today: '2026-10-06', offsetBefore: 120, offsetNow: -600 }),
      null,
      'two days away is not a skipped date',
    );
    const recent: StreakCover[] = [{ day: '2026-09-28', kind: 'travel', at: 0 }];
    assert.equal(travelCover({ ...base, covers: recent, offsetBefore: 120, offsetNow: -600 }), null);
    const older: StreakCover[] = [{ day: '2026-09-27', kind: 'travel', at: 0 }];
    assert.equal(TRAVEL_EVERY_DAYS, 7);
    assert.equal(travelCover({ ...base, covers: older, offsetBefore: 120, offsetNow: -600 }), '2026-10-04');
    assert.equal(
      travelCover({ ...base, practiceDays: ['2026-10-05'], offsetBefore: 120, offsetNow: -600 }),
      null,
      'with no run before the gap there is nothing to keep',
    );
  });
});
