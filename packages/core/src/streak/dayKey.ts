/**
 * Calendar days as `YYYY-MM-DD` strings, and the arithmetic on them.
 *
 * A practice day is the local calendar date on which a sitting finishes
 * (`dayKeyOf`, which is `localDayKey` from the levels module, so the streak and
 * the XP cap agree on what "today" means). Everything after that point works on
 * the strings alone.
 *
 * Day arithmetic never adds milliseconds. A local day is 23 or 25 hours long
 * twice a year, and a fixed 86,400,000 ms step across one of those either
 * skips a date or repeats it, which on a streak would silently break a run the
 * learner kept. So a key is turned into a UTC calendar date at midnight, moved
 * by whole days there, and turned back. UTC has no daylight saving, so the
 * answer is the same in every time zone and on every day of the year.
 */

import { localDayKey } from '../levels/levels.ts';

export type DayKey = string;

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Whole days since 1970-01-01 for a valid key, or null. */
function epochDay(key: string): number | null {
  const match = DAY_KEY.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function fromEpochDay(n: number): DayKey {
  const d = new Date(n * MS_PER_DAY);
  const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${`${d.getUTCFullYear()}`.padStart(4, '0')}-${month}-${day}`;
}

function mustEpochDay(key: DayKey): number {
  const n = epochDay(key);
  if (n === null) throw new RangeError(`Not a calendar day: "${key}"`);
  return n;
}

/** True for a real calendar date written `YYYY-MM-DD` (so not 2027-02-29). */
export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && epochDay(value) !== null;
}

/** The local calendar date a timestamp falls on, in the device's time zone. */
export function dayKeyOf(at: number): DayKey {
  return localDayKey(at);
}

/** The key `days` calendar days after `key` (before it, when negative). */
export function addDays(key: DayKey, days: number): DayKey {
  return fromEpochDay(mustEpochDay(key) + Math.trunc(days));
}

/** Calendar days from `from` to `to`: 1 for the next day, -1 for the one before. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return mustEpochDay(to) - mustEpochDay(from);
}

/** Every key from `from` to `to`, both included, oldest first. Empty when `to` is earlier. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const start = mustEpochDay(from);
  const end = mustEpochDay(to);
  const out: DayKey[] = [];
  for (let n = start; n <= end; n += 1) out.push(fromEpochDay(n));
  return out;
}

/** 0 for Monday through 6 for Sunday. */
export function weekdayIndex(key: DayKey): number {
  // 1970-01-01 was a Thursday, index 3 in a Monday-first week.
  return (((mustEpochDay(key) + 3) % 7) + 7) % 7;
}

/** The Monday on or before `key`. */
export function mondayOf(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

/** Days in a month, `month` counted from 1. Leap years follow the Gregorian rule. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Minutes this device's clock is ahead of UTC at `at`: 60 in Paris in winter,
 * 120 in summer, -300 in New York in winter. The opposite sign to
 * `Date#getTimezoneOffset`, so east is positive as people say it.
 */
export function utcOffsetMinutesAt(at: number): number {
  const offset = -new Date(at).getTimezoneOffset();
  return offset === 0 ? 0 : offset; // never -0
}
