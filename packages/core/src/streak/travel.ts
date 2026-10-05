/**
 * The travel cover: a flight west across the date line can skip a whole local
 * date, and that is not a day the learner chose to miss.
 *
 * When the uncovered gap is exactly one day and the device's UTC offset at
 * this practice differs by three hours or more from the offset at the previous
 * practice, the day is covered, at most once every seven days. Founder decision
 * D4 makes streak protection a paid-plan perk, so it is entitled-only like the
 * freeze. It is checked before freezes so a trip never spends one.
 *
 * The offsets are facts about this phone, kept device-locally by the app and
 * never synced; core only compares the two numbers it is handed.
 */

import { addDays, daysBetween, isDayKey, type DayKey } from './dayKey.ts';
import { runLengthEndingAt, streakFrom, type StreakInput } from './streak.ts';

/** A clock change of at least this many minutes reads as travel. */
export const TRAVEL_OFFSET_MINUTES = 180;

/** At most one travel cover in this many days. */
export const TRAVEL_EVERY_DAYS = 7;

/** The day to cover for travel, or null. */
export function travelCover(
  input: StreakInput & {
    entitled: boolean;
    /** Minutes ahead of UTC at this practice. */
    offsetNow: number;
    /** Minutes ahead of UTC at the previous practice, or null when unknown. */
    offsetBefore: number | null;
  },
): DayKey | null {
  if (input.entitled !== true) return null;
  const { offsetNow, offsetBefore } = input;
  if (offsetBefore === null || !Number.isFinite(offsetNow) || !Number.isFinite(offsetBefore)) return null;
  if (Math.abs(offsetNow - offsetBefore) < TRAVEL_OFFSET_MINUTES) return null;

  const { gap } = streakFrom(input);
  if (gap.length !== 1) return null;
  const day = gap[0]!;
  if (runLengthEndingAt(input, addDays(day, -1)) < 1) return null;

  for (const cover of input.covers) {
    if (cover.kind !== 'travel' || !isDayKey(cover.day)) continue;
    if (Math.abs(daysBetween(cover.day, day)) < TRAVEL_EVERY_DAYS) return null;
  }
  return day;
}
