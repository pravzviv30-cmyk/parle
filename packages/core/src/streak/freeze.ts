/**
 * Streak freezes (founder decisions D4, D23).
 *
 * A subscriber holds up to two (FREEZE_CAP); a free learner holds one
 * (FREE_FREEZE_CAP, D23, 2026-10-20). When a day gets away, a freeze covers it
 * automatically, and a used freeze comes back seven days after the day it
 * covered. If a sync later shows the learner did practise that day, the freeze
 * was never needed and is refunded at once.
 *
 * `cap` is decided by the caller from the server's billing answer, never a
 * guess: FREEZE_CAP for a confirmed paid plan that has not lapsed,
 * FREE_FREEZE_CAP for a learner known to be on the free plan, and 0 when the
 * answer is unknown, so nothing is applied and the gap simply waits.
 * `protectedSince` is the first day the learner held this protection; a freeze
 * never covers a day before it, so no plan can be bought (or account made) to
 * cover a day that had already passed uncovered. No screen may offer a plan as
 * a way to save a streak.
 */

import { addDays, daysBetween, isDayKey, type DayKey } from './dayKey.ts';
import { runLengthEndingAt, streakDaysOf, streakFrom, type StreakInput } from './streak.ts';

/** Freezes a paid learner holds. */
export const FREEZE_CAP = 2;

/** Freezes a free learner holds (D23). */
export const FREE_FREEZE_CAP = 1;

/** A used freeze comes back this many days after the day it covered. */
export const FREEZE_RETURN_DAYS = 7;

/** The streak a freeze reads. The cap is passed beside it, never inside it. */
export type FreezeInput = StreakInput;

const capOf = (cap: number): number => (Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0);

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

/** Freezes ready to use today, out of `cap`. A cap of 0 always holds none. */
export function freezesHeld(cap: number, input: FreezeInput): number {
  const c = capOf(cap);
  if (c === 0) return 0;
  return Math.max(0, c - freezesInUse(input).length);
}

/**
 * The day the next used freeze comes back, or null when none is in use.
 * A real date from a real cover, for "One comes back on {day}".
 */
export function nextFreezeReturn(cap: number, input: FreezeInput): DayKey | null {
  if (capOf(cap) === 0) return null;
  const inUse = freezesInUse(input);
  return inUse.length > 0 ? addDays(inUse[0]!, FREEZE_RETURN_DAYS) : null;
}

/**
 * The gap days to cover with freezes now, or none.
 *
 * All or nothing: freezes are spent only when they save the run, so a gap
 * longer than the freezes held spends none. Never today, never a day before
 * `protectedSince`, and never when there was no run to keep.
 */
export function freezesToApply(cap: number, input: FreezeInput & { protectedSince: DayKey | null }): DayKey[] {
  if (capOf(cap) === 0 || !isDayKey(input.protectedSince)) return [];
  const { gap } = streakFrom(input);
  if (gap.length === 0 || gap.length > freezesHeld(cap, input)) return [];
  if (gap[0]! < input.protectedSince) return [];
  if (runLengthEndingAt(input, addDays(gap[0]!, -1)) < 1) return [];
  return gap;
}
