import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  dayKeyOf,
  dayRange,
  daysBetween,
  daysInMonth,
  isDayKey,
  mondayOf,
  utcOffsetMinutesAt,
  weekdayIndex,
} from './dayKey.ts';

// Each test file runs in its own process, so this zone is this file's alone.
// Paris changes its clocks on 2026-03-29 (a 23-hour day) and 2026-10-25 (a
// 25-hour day), which is what these tests are about.
process.env.TZ = 'Europe/Paris';

/** A Paris wall-clock moment, built from its UTC equivalent so the test never depends on the zone it asserts. */
const utc = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h, min);

describe('calendar days', () => {
  test('the zone under test really is Paris', () => {
    // Winter is UTC+1 and summer UTC+2. If this fails, every test below is
    // testing some other zone and proves nothing about daylight saving.
    assert.equal(utcOffsetMinutesAt(utc(2026, 1, 15, 12)), 60);
    assert.equal(utcOffsetMinutesAt(utc(2026, 7, 15, 12)), 120);
  });

  test('a practice day is the local date a sitting finishes on', () => {
    // 23:50 UTC on the 28th of March is 00:50 in Paris on the 29th.
    assert.equal(dayKeyOf(utc(2026, 3, 28, 23, 50)), '2026-03-29');
    assert.equal(dayKeyOf(utc(2026, 3, 28, 22, 50)), '2026-03-28');
  });

  test('the spring clock change neither skips nor repeats a date', () => {
    // 00:30 on the 30th, minus 24 hours of milliseconds, lands at 23:30 on the
    // 28th: a step of fixed length would skip the 29th entirely.
    const halfPastMidnight30th = utc(2026, 3, 29, 22, 30);
    assert.equal(dayKeyOf(halfPastMidnight30th), '2026-03-30');
    assert.equal(dayKeyOf(halfPastMidnight30th - 86_400_000), '2026-03-28', 'the trap this module exists to avoid');
    assert.equal(addDays('2026-03-30', -1), '2026-03-29');
    assert.equal(addDays('2026-03-28', 1), '2026-03-29');
    assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
    assert.deepEqual(dayRange('2026-03-28', '2026-03-30'), ['2026-03-28', '2026-03-29', '2026-03-30']);
  });

  test('the autumn clock change neither skips nor repeats a date', () => {
    // 23:30 on the 25th, minus 24 hours of milliseconds, is 00:30 on the same
    // 25th: a fixed step would count one date twice.
    const lateOn25th = utc(2026, 10, 25, 22, 30);
    assert.equal(dayKeyOf(lateOn25th), '2026-10-25');
    assert.equal(dayKeyOf(lateOn25th - 86_400_000), '2026-10-25', 'the trap this module exists to avoid');
    assert.equal(addDays('2026-10-25', -1), '2026-10-24');
    assert.equal(addDays('2026-10-25', 1), '2026-10-26');
    assert.deepEqual(dayRange('2026-10-24', '2026-10-26'), ['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  test('a leap day exists in 2028 and not in 2027', () => {
    assert.ok(isDayKey('2028-02-29'));
    assert.ok(!isDayKey('2027-02-29'));
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2028-02-29', 1), '2028-03-01');
    assert.equal(addDays('2027-02-28', 1), '2027-03-01');
    assert.equal(daysInMonth(2028, 2), 29);
    assert.equal(daysInMonth(2027, 2), 28);
    assert.equal(daysInMonth(2100, 2), 28, 'a century is not a leap year unless it divides by 400');
    assert.equal(daysInMonth(2000, 2), 29);
  });

  test('the year rolls over and back', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2027-01-01', -1), '2026-12-31');
    assert.equal(daysBetween('2026-12-25', '2027-01-05'), 11);
    assert.equal(daysBetween('2027-01-05', '2026-12-25'), -11);
    assert.equal(addDays('2026-10-05', 365), '2027-10-05');
  });

  test('weeks start on Monday', () => {
    assert.equal(weekdayIndex('2026-10-05'), 0, '5 October 2026 is a Monday');
    assert.equal(weekdayIndex('2026-03-29'), 6, '29 March 2026 is a Sunday');
    assert.equal(weekdayIndex('2028-02-29'), 1, '29 February 2028 is a Tuesday');
    assert.equal(mondayOf('2026-10-11'), '2026-10-05');
    assert.equal(mondayOf('2027-01-01'), '2026-12-28', 'a week can start in the old year');
    assert.equal(weekdayIndex('1969-12-31'), 2, 'days before 1970 still land on the right weekday');
  });

  test('only a real calendar date is a day key', () => {
    for (const bad of ['', '2026-13-01', '2026-00-10', '2026-04-31', '2026-4-01', '26-04-01', '2026-04-01T00:00', 20260401, null]) {
      assert.ok(!isDayKey(bad), `${String(bad)} is not a day`);
    }
    assert.throws(() => addDays('2026-02-30', 1), RangeError);
    assert.deepEqual(dayRange('2026-10-06', '2026-10-05'), []);
  });

  test('the offset is east-positive and never negative zero', () => {
    process.env.TZ = 'UTC';
    try {
      assert.ok(Object.is(utcOffsetMinutesAt(utc(2026, 1, 1, 12)), 0));
    } finally {
      process.env.TZ = 'Europe/Paris';
    }
  });
});
