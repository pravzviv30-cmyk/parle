/**
 * Streak repair: a paid-plan perk that is still earned by practice (D4).
 *
 * When a run ends with an uncovered gap of at most two days, a subscriber can
 * bring it back by finishing two practices within 48 hours of the break. The
 * streak breaks at the start of the day after the first uncovered day (until
 * then that day was still "today" and open), so the 48 hours are the two
 * calendar days that follow it. Calendar days rather than clock hours, for the
 * reason in dayKey.ts: a day near a clock change is 23 or 25 hours long, and a
 * window that shrank or stretched with it would be a rule nobody could state.
 *
 * Entitlement is checked at repair time, not against when the plan began: a
 * free learner who has just broken a streak is told, once and calmly, that
 * subscribers can repair one within two days. Repair is never bought at the
 * moment of loss, because it still takes two finished practices.
 *
 * Freezes go first. The app applies `freezesToApply` before asking here, so a
 * gap a freeze could cover never becomes a repair.
 */

import { addDays, daysBetween, isDayKey, type DayKey } from './dayKey.ts';
import { localDayKey } from '../levels/levels.ts';
import { runLengthEndingAt, streakDaysOf, type StreakInput } from './streak.ts';

/** The longest uncovered gap a repair can restore, in days. */
export const REPAIR_MAX_GAP = 2;

/** Finished practices a repair takes. */
export const REPAIR_PRACTICES = 2;

/** 48 hours after the break, as calendar days. */
export const REPAIR_WINDOW_DAYS = 2;

/**
 * At most one repair in this many days, measured from the day a repair
 * covered to the first day of the new gap. 0 means no limit.
 *
 * Seven, by founder decision D19 (6 October 2026): a subscriber may repair a
 * streak at most once a week, so a run cannot be carried forever at half the
 * practice rate, while a freeze still covers a single missed day. The first
 * draft of the game spec (docs/come-alive/game.md 2.4) had 30.
 * `repairOfferWithLimit` is how the tests prove any limit holds.
 */
export const REPAIR_EVERY_DAYS = 7;

export interface StreakBreak {
  /** The uncovered days a repair would cover, oldest first: one or two. */
  days: DayKey[];
  /** Practice days in the run the gap ended. The number "{n}-day streak" names. */
  runBefore: number;
  /** The day the streak broke: the day after the first uncovered day. */
  windowStart: DayKey;
  /** The last day a practice counts toward the repair. */
  windowEnd: DayKey;
}

export interface RepairOffer extends StreakBreak {
  needed: number;
  /** Finished practices inside the window so far, never above `needed`. */
  done: number;
  /** True once `done` reaches `needed`: the caller writes a `repair` cover for each of `days`. */
  ready: boolean;
}

/**
 * The most recent gap a repair could still restore, whoever the learner is.
 *
 * Free of billing on purpose: the free learner's one calm line asks the same
 * question ("did a streak just end, recently enough to repair?") and must get
 * the same answer a subscriber would.
 */
export function recentBreak(input: StreakInput): StreakBreak | null {
  const { today, practised, covered } = streakDaysOf(input);
  const counts = (day: DayKey) => practised.has(day) || covered.has(day);

  // Step back over the new run since the gap (today is open, not a gap). Any
  // gap older than the window is past repair, so the walk is short.
  let last = addDays(today, -1);
  for (let i = 0; i <= REPAIR_WINDOW_DAYS && counts(last); i += 1) last = addDays(last, -1);
  if (counts(last)) return null;

  const days: DayKey[] = [last];
  let before = addDays(last, -1);
  while (!counts(before)) {
    if (days.length >= REPAIR_MAX_GAP) return null;
    days.unshift(before);
    before = addDays(before, -1);
  }

  const runBefore = runLengthEndingAt(input, before);
  if (runBefore < 1) return null;

  const windowStart = addDays(days[0]!, 1);
  const windowEnd = addDays(days[0]!, REPAIR_WINDOW_DAYS);
  if (today > windowEnd) return null;
  return { days, runBefore, windowStart, windowEnd };
}

type RepairInput = StreakInput & {
  entitled: boolean;
  sittings: readonly { at: number }[];
  dayKey?: (at: number) => string;
};

/**
 * The repair a subscriber can earn now, or null.
 *
 * `sittings` are finished practices (any kind, including zero-XP ones), each
 * at the moment it finished. Null for a learner without a paid plan, for a gap
 * longer than two days, once the window has passed, and when a repair within
 * `REPAIR_EVERY_DAYS` already restored a day.
 */
export function repairOffer(input: RepairInput): RepairOffer | null {
  return repairOfferWithLimit(input, REPAIR_EVERY_DAYS);
}

/**
 * `repairOffer` under a given limit, the way `travelCover` limits travel.
 *
 * Only a repair the streak actually used counts against the limit: a repair
 * cover on a day that turned out to be practised, or one that lost its day to
 * an earlier cover, restored nothing. Not exported from the package; the app
 * calls `repairOffer`, so `REPAIR_EVERY_DAYS` is the one place the rule lives.
 */
export function repairOfferWithLimit(input: RepairInput, everyDays: number): RepairOffer | null {
  if (input.entitled !== true) return null;
  const found = recentBreak(input);
  if (!found) return null;
  if (everyDays > 0) {
    for (const [day, kind] of streakDaysOf(input).covered) {
      if (kind !== 'repair') continue;
      if (Math.abs(daysBetween(day, found.days[0]!)) < everyDays) return null;
    }
  }
  const dayKey = input.dayKey ?? localDayKey;
  let done = 0;
  for (const sitting of input.sittings) {
    const day = dayKey(sitting.at);
    if (isDayKey(day) && day >= found.windowStart && day <= found.windowEnd && day <= input.today) done += 1;
  }
  return {
    ...found,
    needed: REPAIR_PRACTICES,
    done: Math.min(done, REPAIR_PRACTICES),
    ready: done >= REPAIR_PRACTICES,
  };
}
