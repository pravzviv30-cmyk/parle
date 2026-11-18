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
 *
 * A day with two finished practices banks one freeze above the cap (founder,
 * 2026-11-18). There is one bank slot. A banked freeze is spent before the
 * plan's own, does not come back on a timer, and is earned again no sooner
 * than seven days after the day it covered. It is read from `bankDays` and the
 * resolved covers, so nothing new is stored. A bank earned on a day never
 * covers a day before it, and a cap of 0 holds none.
 */

import { addDays, daysBetween, isDayKey, type DayKey } from './dayKey.ts';
import { runLengthEndingAt, streakDaysOf, streakFrom, type StreakInput } from './streak.ts';

/** Freezes a paid learner holds. */
export const FREEZE_CAP = 2;

/** Freezes a free learner holds (D23). */
export const FREE_FREEZE_CAP = 1;

/** A used freeze comes back this many days after the day it covered. */
export const FREEZE_RETURN_DAYS = 7;

/**
 * The streak a freeze reads. The cap is passed beside it, never inside it.
 * `bankDays` are the days with two or more finished practices; absent means no bank.
 */
export type FreezeInput = StreakInput & { bankDays?: readonly DayKey[] };

const capOf = (cap: number): number => (Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0);

/** The days holding two or more finished sittings, oldest first. */
export function doublePracticeDays(sittings: readonly { at: number }[], dayKey: (at: number) => string): DayKey[] {
  const seen = new Map<DayKey, number>();
  for (const sitting of sittings) {
    const day = dayKey(sitting.at);
    if (isDayKey(day)) seen.set(day, (seen.get(day) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n >= 2).map(([day]) => day).sort();
}

/**
 * The bank, walked day by day over the resolved freeze covers and `bankDays`.
 *
 * A freeze cover while a freeze is banked is paid by the bank. A bank day
 * fills an empty bank when it is at least FREEZE_RETURN_DAYS after the last
 * day the bank covered. On one day the cover is read before the earn. Bank
 * days on or after `before` are left out, so the bank can be read as it stood
 * before a gap.
 */
function bankWalk(input: FreezeInput, before?: DayKey): { banked: boolean; paid: Set<DayKey> } {
  const { today, covered } = streakDaysOf(input);
  const earns = new Set((input.bankDays ?? []).filter((day) => isDayKey(day) && day <= today && (before === undefined || day < before)));
  const days = [...new Set([...earns, ...[...covered].filter(([, kind]) => kind === 'freeze').map(([day]) => day)])].sort();
  let banked = false;
  let lastCover: DayKey | null = null;
  const paid = new Set<DayKey>();
  for (const day of days) {
    if (banked && covered.get(day) === 'freeze') {
      banked = false;
      lastCover = day;
      paid.add(day);
    }
    if (!banked && earns.has(day) && (lastCover === null || daysBetween(lastCover, day) >= FREEZE_RETURN_DAYS)) banked = true;
  }
  return { banked, paid };
}

/** True when a freeze is banked today, above the cap. */
export function freezeBanked(input: FreezeInput): boolean {
  return bankWalk(input).banked;
}

/**
 * Days the streak covered with a freeze that are still within their seven days.
 *
 * Read from the streak's own resolved covers, not the raw list, so a freeze is
 * spent only on a day the streak actually used it for. Two devices can write a
 * repair and a freeze for the same day; the streak keeps one of them (the
 * earliest written, a tie going to repair), and a freeze it did not keep was
 * never used. A day that turns out to be practised needs no cover at all, so
 * its freeze is refunded the same way. A cover the bank paid is not one of them.
 */
function freezesInUse(input: FreezeInput): DayKey[] {
  const { today, covered } = streakDaysOf(input);
  const { paid } = bankWalk(input);
  const days: DayKey[] = [];
  for (const [day, kind] of covered) {
    if (kind !== 'freeze' || paid.has(day)) continue;
    const age = daysBetween(day, today);
    if (age >= 1 && age < FREEZE_RETURN_DAYS) days.push(day);
  }
  return days.sort();
}

/** Freezes ready to use today, out of `cap`, plus a banked one. A cap of 0 always holds none. */
export function freezesHeld(cap: number, input: FreezeInput): number {
  const c = capOf(cap);
  if (c === 0) return 0;
  return Math.max(0, c - freezesInUse(input).length) + (freezeBanked(input) ? 1 : 0);
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
 * `protectedSince`, and never when there was no run to keep. The bank counts
 * only as it stood before the gap, so practice today never covers a day gone.
 */
export function freezesToApply(cap: number, input: FreezeInput & { protectedSince: DayKey | null }): DayKey[] {
  if (capOf(cap) === 0 || !isDayKey(input.protectedSince)) return [];
  const { gap } = streakFrom(input);
  if (gap.length === 0) return [];
  const held = Math.max(0, capOf(cap) - freezesInUse(input).length) + (bankWalk(input, gap[0]).banked ? 1 : 0);
  if (gap.length > held) return [];
  if (gap[0]! < input.protectedSince) return [];
  if (runLengthEndingAt(input, addDays(gap[0]!, -1)) < 1) return [];
  return gap;
}

/** What a learner's freezes may reach: their cap, and the first days a paid plan and any protection were seen. */
export interface FreezeProtection {
  cap: number;
  paidSince: DayKey | null;
  protectedSince: DayKey | null;
}

/**
 * The gap days freezes cover now, or none: the one rule the streak (settle)
 * and the reminder planner both read, so they can never disagree.
 *
 * A paid plan's two freezes never reach before the plan (paidSince); the one
 * every learner holds reaches back only to protectedSince (D23). So a plan
 * bought after a gap cannot spend its second freeze on that gap.
 */
export function freezeCoverDays(protection: FreezeProtection, input: FreezeInput): DayKey[] {
  const both = protection.cap >= FREEZE_CAP ? freezesToApply(protection.cap, { ...input, protectedSince: protection.paidSince }) : [];
  return both.length > 0 ? both : freezesToApply(Math.min(protection.cap, FREE_FREEZE_CAP), { ...input, protectedSince: protection.protectedSince });
}
