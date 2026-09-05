/**
 * Daily momentum — three honest counts, or nothing at all.
 *
 * Home's fourth block draws two half tiles and one card: days active, phrases
 * retained, and today's speaking goal. Each of the three is a fold over data
 * somebody else owns, each carries its own copy, and each is independently
 * `null` when it has nothing true to say. A learner on their first run gets
 * `{ days: null, retained: null, goal: null }`, `hasMomentum` is false, and the
 * block is not drawn.
 *
 * ## Why this is a second module and not an extension of today.ts
 *
 * `progress/today.ts` answers one question — how many sittings happened today —
 * and its whole design is the refusal of a streak: no chain, no loss state, and
 * nothing rendered at zero. Its suite is the standing defence of that refusal,
 * and the value of a defence is that it does not move. Widening `Today` to also
 * carry a day count, a settled-card count and a minutes goal would put
 * three unrelated folds behind one gate, and the first surface that wanted two
 * of the three would have to reach past `hasToday` to get them. Then the suite
 * that says "this does not render at zero" would be guarding a shape where zero
 * means four different things.
 *
 * So: same principles, separate module. `today.ts` keeps its one job and its
 * one gate, and this file is where a fourth number can arrive without anybody
 * having to re-argue the third.
 *
 * ## Why "Days active" is not a streak either
 *
 * PRODUCT.md:90-94 rules out the streak as "a guilt mechanic implicated in
 * intermediate-plateau churn", and this tile sits where one would go, so it is
 * built so that it cannot become one:
 *
 *   - **It only ever rises.** The count is distinct local days carrying an
 *     entry, over every entry the log still holds. Nothing subtracts, and no
 *     absence is counted: a month away and the number is exactly
 *     what it was.
 *   - **There is no chain.** Days do not have to be consecutive, and no code
 *     here asks whether yesterday had an entry. Seven days apart counts as
 *     seven, the same as seven in a row.
 *   - **There is no loss state.** No field on `Momentum` can say something was
 *     broken, at risk, or owed, because none exists to set.
 *   - **It is absent at zero.** A rail of empty marks is a quota, and a quota
 *     you have not met is guilt wearing a different hat. `progress/today.ts` and
 *     `progress/evidence.ts` both refuse to render at zero; this is the same
 *     restraint, and `momentum.test.ts` proves each of these four by name.
 *
 * The seven marks are a picture of the last seven days, not a target. Seven
 * filled marks says nothing more than four does, and no copy in this file reads
 * the row at all.
 *
 * ## Nothing here is stored, and nothing here reads a clock
 *
 * Every number is recomputed from the activity log, the deck and the profile
 * every time it is asked for, and `now` arrives as a parameter, because a rule
 * about local days that cannot be tested across a midnight is a rule nobody can
 * trust.
 */

import { isSettled, localDayKey, type ReviewCard } from '@luvani/core';
import { dailyGoalOf, type GoalMinutes } from '../profile/dailyGoal.ts';
import type { StoredProfile } from '../profile/store.ts';
import type { ActivityEntry, ActivityKind } from './activity.ts';

/** How many marks the days tile draws, and how far back "this week" reaches. */
export const MOMENTUM_WEEK_DAYS = 7;

/** The tile labels, from the mockup. Exported so the screen reads them rather than spelling them. */
export const DAYS_LABEL = 'Days active';
export const RETAINED_LABEL = 'Retained';
export const GOAL_TITLE = "Today's speaking goal";

/**
 * What the goal card's footer says once the day's minutes are in.
 *
 * Warm and finished. It does not ask for more, because the promise was the
 * number and the number has been met, and "keep going" at that moment is the
 * app moving the line the learner just crossed.
 */
export const GOAL_MET = 'Daily cadence reached. Well done.';

/**
 * What counts as speaking.
 *
 * `review` is deliberately not here. The card deck is recall — a phrase read,
 * recognised and graded — and the mockup calls this card a *speaking* goal, so
 * counting review minutes under that name would be false. The other three all
 * put the learner in a situation producing French, whether they spoke it or
 * typed it, which is the same rule `today.ts` counts sittings by.
 */
export const SPOKEN_KINDS: readonly ActivityKind[] = ['convo', 'lesson', 'drill'];

export interface MomentumDays {
  /**
   * Distinct local days carrying at least one entry.
   *
   * Every day the learner has ever had is very nearly what this is, and not
   * quite, so it claims the smaller true thing: `progress/activity.ts` prunes
   * entries older than its `KEEP_DAYS` window on every write, so this counts the
   * days the log still holds. Within
   * that window nothing subtracts and no absence is counted, which is the
   * property that matters. Somebody four hundred days in will see the number
   * settle rather than climb, and that is the honest reading of it.
   */
  count: number;
  /**
   * The last seven local days ending today, oldest first, true where something
   * happened. Index six is today. A picture, never a target.
   */
  week: readonly boolean[];
  /** 'Days active'. */
  label: string;
  /** 'days', or 'day' at one. */
  unit: string;
}

export interface MomentumRetained {
  /** Cards `isSettled` says are settled right now. */
  count: number;
  /**
   * How many of those settled in the last seven local days, or null when none
   * did.
   *
   * Null rather than zero, and the difference is the whole point. `settledAt`
   * is absent on every card graded before it existed, so an established learner
   * sees no weekly figure at all until something settles after this ships. That
   * is honest: we do not know when those phrases landed, and "+0 this week"
   * would be us claiming we do.
   */
  thisWeek: number | null;
  /** 'Retained'. */
  label: string;
  /** 'phrases', or 'phrase' at one. */
  unit: string;
  /** '+4 this week', or null when nothing settled this week. */
  weekLine: string | null;
}

export interface MomentumGoal {
  /** Whole minutes of speaking today. At least one: zero is absent, not drawn. */
  minutes: number;
  /** What the learner asked for, from `dailyGoalOf`. */
  target: GoalMinutes;
  /** Whole minutes still to go, floored at zero. */
  remaining: number;
  /** How far along, 0 to 100, for the bar. Clamped, so an over-run never overflows it. */
  percent: number;
  /** "Today's speaking goal". */
  title: string;
  /** '6 / 10 min', right aligned on the card. */
  amount: string;
  /** The footer's left half: what is left, or the warm line once it is met. */
  note: string;
  /** The footer's right half: '60%'. */
  percentLabel: string;
}

export interface Momentum {
  days: MomentumDays | null;
  retained: MomentumRetained | null;
  goal: MomentumGoal | null;
}

/** True when Home should draw the block at all. False draws nothing, not a rail of zeros. */
export function hasMomentum(momentum: Momentum): boolean {
  return momentum.days !== null || momentum.retained !== null || momentum.goal !== null;
}

/**
 * The local day keys of the last `span` days ending on `now`, oldest first.
 *
 * Walked with `setDate` from midday rather than by subtracting 86,400,000 ms.
 * A local day is 23 or 25 hours long twice a year, and fixed-width steps across
 * one of those either skip a date or repeat it — which on the days tile would
 * silently blank a day the learner practised on. Midday keeps every step well
 * clear of both boundaries.
 */
function recentDayKeys(now: number, span: number): string[] {
  const anchor = new Date(now);
  anchor.setHours(12, 0, 0, 0);
  const keys: string[] = [];
  for (let back = span - 1; back >= 0; back -= 1) {
    const day = new Date(anchor);
    day.setDate(anchor.getDate() - back);
    keys.push(localDayKey(day.getTime()));
  }
  return keys;
}

/**
 * Days active, or null when nothing has ever been logged.
 *
 * The count is a set size, which is what makes it monotone: entries are only
 * ever appended, and adding an entry can only leave the set the same size or
 * make it larger. Time passing adds nothing and removes nothing.
 */
function daysFrom(activity: readonly ActivityEntry[], now: number): MomentumDays | null {
  const active = new Set<string>();
  for (const entry of activity) active.add(localDayKey(entry.at));
  if (active.size === 0) return null;

  return {
    count: active.size,
    week: recentDayKeys(now, MOMENTUM_WEEK_DAYS).map((key) => active.has(key)),
    label: DAYS_LABEL,
    unit: active.size === 1 ? 'day' : 'days',
  };
}

/** Phrases that have stuck, or null when none has yet. */
function retainedFrom(deck: readonly ReviewCard[], now: number): MomentumRetained | null {
  const settled = deck.filter((card) => isSettled(card, now));
  if (settled.length === 0) return null;

  const week = new Set(recentDayKeys(now, MOMENTUM_WEEK_DAYS));
  const recent = settled.filter((card) => card.settledAt !== undefined && week.has(localDayKey(card.settledAt)));
  const thisWeek = recent.length === 0 ? null : recent.length;

  return {
    count: settled.length,
    thisWeek,
    label: RETAINED_LABEL,
    unit: settled.length === 1 ? 'phrase' : 'phrases',
    weekLine: thisWeek === null ? null : `+${thisWeek} this week`,
  };
}

/**
 * Today's speaking goal, or null.
 *
 * Two ways to be absent, and both are honest rather than tidy. No goal set
 * means the learner has never been asked for one, and a card measuring them
 * against a number they did not choose is the app inventing a promise on their
 * behalf. Zero whole minutes means either they have not started today or every
 * sitting they did predates `durationMs`, and "0 / 10 min" would read as a
 * failure in both cases.
 *
 * Minutes are floored, never rounded up. This is a claim about time the learner
 * actually spent, and the direction to be wrong in is the modest one.
 */
function goalFrom(
  activity: readonly ActivityEntry[],
  profile: StoredProfile | null,
  now: number,
): MomentumGoal | null {
  const target = dailyGoalOf(profile);
  if (target === null) return null;

  const today = localDayKey(now);
  let spokenMs = 0;
  for (const entry of activity) {
    if (!SPOKEN_KINDS.includes(entry.kind)) continue;
    if (localDayKey(entry.at) !== today) continue;
    spokenMs += entry.durationMs ?? 0;
  }

  const minutes = Math.floor(spokenMs / 60_000);
  if (minutes <= 0) return null;

  const remaining = Math.max(0, target - minutes);
  // Computed from the whole minutes rather than the raw milliseconds, so the
  // bar, the percentage and "6 / 10 min" are three readings of one number
  // instead of three numbers that disagree at the edges.
  const percent = Math.min(100, Math.round((minutes / target) * 100));

  const left = `${remaining} more ${remaining === 1 ? 'minute' : 'minutes'} to reach daily cadence`;

  return {
    minutes,
    target,
    remaining,
    percent,
    title: GOAL_TITLE,
    amount: `${minutes} / ${target} min`,
    note: remaining === 0 ? GOAL_MET : left,
    percentLabel: `${percent}%`,
  };
}

/**
 * The whole block, folded from what the learner has actually done.
 *
 * Nothing is written, nothing is cached and nothing is read from a clock. The
 * three parts are independent on purpose: a learner can have days and no
 * retained phrases, or a goal and neither of the other two, and the block draws
 * whichever of the three are real.
 */
export function momentumFrom(input: {
  activity: readonly ActivityEntry[];
  deck: readonly ReviewCard[];
  /** Null is allowed: Home asks before the profile has loaded, and no profile is no goal. */
  profile: StoredProfile | null;
  now: number;
}): Momentum {
  return {
    days: daysFrom(input.activity, input.now),
    retained: retainedFrom(input.deck, input.now),
    goal: goalFrom(input.activity, input.profile, input.now),
  };
}
