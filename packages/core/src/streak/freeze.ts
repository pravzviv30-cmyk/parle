/**
 * Streak freezes: a paid-plan perk (founder decision D4).
 *
 * A subscriber holds up to two. When a day gets away from them, a freeze
 * covers it automatically, and a used freeze comes back seven days after the
 * day it covered. If a sync later shows the learner did practise that day, the
 * freeze was never needed and is refunded at once.
 *
 * `entitled` is the server's billing answer, never a guess: the app passes
 * true only for a confirmed paid plan that has not lapsed. When the answer is
 * unknown it passes false, nothing is applied, and the gap simply waits.
 * `paidSince` is the first day of the paid plan; a freeze never covers a day
 * before it, so no plan can be bought to cover a day that had already passed
 * uncovered. No screen may offer a plan as a way to save a streak.
 */

import { addDays, daysBetween, isDayKey, type DayKey } from './dayKey.ts';
import { runLengthEndingAt, streakDaysOf, streakFrom, type StreakInput } from './streak.ts';

export const FREEZE_CAP = 2;

/** A used freeze comes back this many days after the day it covered. */
export const FREEZE_RETURN_DAYS = 7;

export interface FreezeInput extends StreakInput {
  entitled: boolean;
}

/**
 * Days the streak covered with a freeze that are still within their seven days.
 *
 * Read from the streak's own resolved covers, not the raw list, so a freeze is
 * spent only on a day the streak actually used it for. Two devices can write a
 * repair and a freeze for the same day; the streak keeps one of them (the
 * earliest written, a tie going to repair), and a freeze it did not keep was
 * never used. A day that turns out to be practised needs no cover at all, so
 * its freeze is refunded the same way.
 */
function freezesInUse(input: FreezeInput): DayKey[] {
  const { today, covered } = streakDaysOf(input);
  const days: DayKey[] = [];
  for (const [day, kind] of covered) {
    if (kind !== 'freeze') continue;
    const age = daysBetween(day, today);
    if (age >= 1 && age < FREEZE_RETURN_DAYS) days.push(day);
  }
  return days.sort();
}

/** Freezes ready to use today. Always 0 for a learner without a paid plan. */
export function freezesHeld(input: FreezeInput): number {
  if (input.entitled !== true) return 0;
  return Math.max(0, FREEZE_CAP - freezesInUse(input).length);
}

/**
 * The day the next used freeze comes back, or null when none is in use.
 * A real date from a real cover, for "One comes back on {day}".
 */
export function nextFreezeReturn(input: FreezeInput): DayKey | null {
  if (input.entitled !== true) return null;
  const inUse = freezesInUse(input);
  return inUse.length > 0 ? addDays(inUse[0]!, FREEZE_RETURN_DAYS) : null;
}

/**
 * The gap days to cover with freezes now, or none.
 *
 * All or nothing: freezes are spent only when they save the run, so a gap
 * longer than the freezes held spends none. Never today, never a day before
 * `paidSince`, and never when there was no run to keep.
 */
export function freezesToApply(input: FreezeInput & { paidSince: DayKey | null }): DayKey[] {
  if (input.entitled !== true || !isDayKey(input.paidSince)) return [];
  const { gap } = streakFrom(input);
  if (gap.length === 0 || gap.length > freezesHeld(input)) return [];
  if (gap[0]! < input.paidSince) return [];
  if (runLengthEndingAt(input, addDays(gap[0]!, -1)) < 1) return [];
  return gap;
}
