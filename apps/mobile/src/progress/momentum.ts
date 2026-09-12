/**
 * Daily momentum — four honest counts, present from the learner's first day.
 *
 * Home's fourth block draws one full-width card and three smaller ones: the
 * phrases this learner has actually used in conversation, the days they have
 * practised, how much of the deck comes back when asked, and today's speaking
 * goal. Each of the four is a fold over data somebody else owns, each carries
 * its own copy, and each is always returned. Where a count would be nought the
 * numeral is withheld and a start line stands in its place.
 *
 * ## Present from the first day, worded as a start
 *
 * This module used to return three nullable parts, and `hasMomentum` used to
 * let Home draw nothing at all until one of them was real. The argument was
 * that a rail of empty marks is a quota, and a quota nobody has met is guilt
 * wearing a different hat. On 2026-09-05 the founder overturned it: the block
 * ships from day one, so a learner meets the four things this app will ever
 * claim about them before it can claim any of them, and every empty count is
 * worded as an invitation rather than a nought.
 *
 * The rule that replaced the gate is per field rather than per block: a numeral
 * is drawn only where the field beside it is non-null, and where a count would
 * be nought the `words` field carries the start line instead. So the shape is
 * never absent and the noughts are never written.
 *
 * ## Why "Days active" is still not a streak
 *
 * PRODUCT.md rules out the streak as "a guilt mechanic implicated in
 * intermediate-plateau churn", and this tile sits where one would go, so it is
 * built so that it cannot become one. Only the fourth leg below was retired
 * with the gate; the other three are what the refusal actually rests on, and
 * `momentum.test.ts` proves each of them by name:
 *
 *   - **It only ever rises.** The count is distinct local days carrying an
 *     entry, over every entry the log still holds. Nothing subtracts, and no
 *     absence is counted: a month away and the number is exactly what it was.
 *   - **There is no chain.** Days do not have to be consecutive, and no code
 *     here asks whether yesterday had an entry. Seven days apart counts as
 *     seven, the same as seven in a row.
 *   - **There is no loss state.** No field on `Momentum` can say something was
 *     broken, at risk, or owed, because none exists to set.
 *   - ~~It is absent at zero.~~ Retired by the founder, 2026-09-05. At zero the
 *     count is `null` and the words are `DAYS_START`, so the tile still writes
 *     no nought and still names no target.
 *
 * The seven marks are a picture of the last seven days, not a target. Seven
 * filled marks says nothing more than four does, and no copy in this file reads
 * the row at all.
 *
 * ## What the recall figure counts, and the first success it throws away
 *
 * `mastery` is right over asked, over every non-phoneme card that has at least
 * one success behind it:
 *
 *     right = sum of (reps - 1)
 *     asked = right + sum of lapses
 *
 * It is floored rather than rounded, because the modest direction is the one to
 * be wrong in, and it is withheld entirely below `MIN_REVIEWS_FOR_RECALL`.
 *
 * The subtraction is the whole design, and it is here because the obvious
 * formula is broken. `reps / (reps + lapses)` reads every grade as a review,
 * and on a first sitting not one of them is: `presentationOf` calls a card with
 * no successful reviews an introduction, so the answer was on screen when the
 * learner pressed good. Ten new cards, ten good grades, and that formula tells
 * somebody who has never recalled anything that their recall is a hundred per
 * cent. Flooring cannot help a genuine ten out of ten, and a floor of ten
 * *grades* is no defence either, because it is counting the very grades that
 * should not have been counted.
 *
 * Dropping one win per card drops exactly the guaranteed one. It needs nothing
 * stored, so every learner who already has a deck is grandfathered and a mature
 * deck shows a real figure the first time Home opens, with nothing to wait for.
 * A genuine first sitting returns null, which is the correct answer.
 *
 * Two things this is honest about rather than exact about. Lapses taken before
 * a card's first success stay in the denominator, because nothing on the card
 * records their order; that pushes the figure down, which is the direction to
 * be wrong in. And a wide shallow deck where every card was reviewed exactly
 * once has `asked` of nought and reads as withheld, which is true — nothing has
 * been recalled yet — but can look like withholding from somebody who has been
 * busy.
 *
 * Below `MIN_REVIEWS_FOR_RECALL` it is withheld. Under ten real reviews one
 * "again" moves the figure by ten points or more, so the number would be
 * describing an afternoon rather than a habit. It is also the one number on
 * Home that can fall, which decision 1 accepted knowingly; the three band lines
 * never scold.
 *
 * Lapses leave this module only inside `asked`. They are never a number of
 * their own and never appear per card.
 *
 * ## Why the tile is called Recall and not Mastery
 *
 * `isMastered` in `packages/core` already means something: three correct
 * unprompted uses in live conversation. A share of review grades is not that,
 * and a tile saying "Mastery" on Home while My French means the other thing by
 * it is two answers to one question, which is the exact failure `evidence.ts`
 * was written to end. So the learner reads "Recall", and the constants keep
 * their names because renaming them would churn the component and the guards
 * for no reader's benefit.
 *
 * ## A deck with no evidence block reads as zero uses, and that is temporary
 *
 * `retained` counts cards the brain has seen used in live conversation, read
 * through `evidenceOf`, so a deck written before the counters existed — or one
 * whose block came back off the wire as null — reads as zero uses rather than
 * throwing. An established learner therefore meets the start line over a full
 * phrasebook until their next conversation. It repairs itself in one sitting:
 * the counts arrive as lifetime totals, so a single conversation raises the
 * whole history at once. Nobody should file it as a bug.
 *
 * `settledAt` is no longer read here at all. The field and `isSettled` stay in
 * core and the phrasebook; what Home claims is now use, not settlement.
 *
 * ## Why this is a second module and not an extension of today.ts
 *
 * `progress/today.ts` answers one question — how many sittings happened today —
 * and its whole design is the refusal of a streak: no chain, no loss state, and
 * nothing rendered at zero. Its suite is the standing defence of that refusal,
 * and the value of a defence is that it does not move. Widening `Today` to also
 * carry a day count, a used-phrase count, a recall percentage and a minutes
 * goal would put four unrelated folds behind one gate, and the first surface
 * that wanted two of the four would have to reach past `hasToday` to get them.
 *
 * So: same principles, separate module. `today.ts` keeps its one job and its
 * one gate, and this file is where a fifth number can arrive without anybody
 * having to re-argue the fourth.
 *
 * ## Nothing here is stored, and nothing here reads a clock
 *
 * Every number is recomputed from the activity log, the deck and the profile
 * every time it is asked for, and `now` arrives as a parameter, because a rule
 * about local days that cannot be tested across a midnight is a rule nobody can
 * trust.
 */

import { evidenceOf, localDayKey, type ReviewCard } from '@luvani/core';
import { DAILY_GOAL_UNSET, dailyGoalOf, type GoalMinutes } from '../profile/dailyGoal.ts';
import type { StoredProfile } from '../profile/store.ts';
import type { ActivityEntry, ActivityKind } from './activity.ts';

/** How many marks the days tile draws, and how far back "this week" reaches. */
export const MOMENTUM_WEEK_DAYS = 7;

/** How many of the learner's own lines the hero card shows before it says "+N more". */
export const RETAINED_CHIPS = 2;

/**
 * How many real reviews the deck needs before a recall percentage means
 * anything.
 *
 * Counted after each card's first success is dropped, so ten here is ten times
 * the learner was asked for a phrase they had already produced once. Ten, and
 * higher than the two floors it sits beside on purpose: `MIN_SAMPLES_TO_FLAG =
 * 3` and `MIN_SESSIONS_FOR_TREND = 2` are floors on a single item; this is a
 * deck-wide headline, and a headline earned from nine answers would swing by
 * more than ten points on one wrong card.
 */
export const MIN_REVIEWS_FOR_RECALL = 10;

/** At or above this the deck is coming back easily. */
export const RECALL_STEADY = 90;
/** At or above this it is settling in. Below it, still fresh. */
export const RECALL_SETTLING = 75;

/** The labels, from the mockup. Exported so the screen reads them rather than spelling them. */
export const DAYS_LABEL = 'Days active';
export const RETAINED_LABEL = 'Retained phrases';
export const RETAINED_SUB = 'Active vocabulary bank';
export const MASTERY_LABEL = 'Recall';
export const GOAL_TITLE = "Today's speaking goal";

/**
 * What each card says before there is a number in it.
 *
 * All four point forwards and none of them names a target, which is the whole
 * difference between an invitation and a quota. They are the fields' `words`,
 * not a separate empty state, so the screen draws one shape either way.
 */
export const DAYS_START = 'Your first practice day shows here';
export const RETAINED_START = 'Your first phrases land here';
export const MASTERY_EARLY = 'Takes shape after a few reviews';
export const GOAL_START = 'Your first minutes today land here';

/** The hero's footer: what earns a phrase its place on that card. */
export const RETAINED_FOOT = 'Each one said in a real conversation';

/** The hero's link, which opens the deck. */
export const RETAINED_LINK = 'Review phrase bank';

/**
 * The line under the recall figure, banded on the percent.
 *
 * Three descriptions of the deck, never of the learner. The mockup's "Gentle
 * spaced rhythm" described our method rather than their French, so it went.
 */
export const MASTERY_LINES = {
  steady: 'Coming back easily',
  settling: 'Settling in',
  fresh: 'Still fresh',
} as const;

/**
 * What the goal card's footer says once the day's minutes are in.
 *
 * Warm and finished. It does not ask for more, because the promise was the
 * number and the number has been met, and "keep going" at that moment is the
 * app moving the line the learner just crossed.
 */
export const GOAL_MET = 'Daily cadence reached. Well done.';

/**
 * Said when today's only spoken sitting recorded no duration.
 *
 * Sittings from before `durationMs` existed measured nothing, and nothing is
 * not zero minutes of speaking. The bar stays empty and the line says why,
 * rather than the learner reading their real conversation as a nought.
 */
export const GOAL_UNTIMED = "Today's sitting was not timed, so it is not on the bar yet";

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
   * Distinct local days carrying at least one entry, or null when there are
   * none. Null rather than zero, so no tile ever draws a nought.
   *
   * Every day the learner has ever had is very nearly what this is, and not
   * quite, so it claims the smaller true thing: `progress/activity.ts` prunes
   * entries older than its `KEEP_DAYS` window on every write, so this counts the
   * days the log still holds. Within that window nothing subtracts and no
   * absence is counted, which is the property that matters. Somebody four
   * hundred days in will see the number settle rather than climb, and that is
   * the honest reading of it.
   */
  count: number | null;
  /**
   * The last seven local days ending today, oldest first, true where something
   * happened. Index six is today. Seven falses on a first run. A picture, never
   * a target.
   */
  week: readonly boolean[];
  /** 'Days active'. */
  label: string;
  /** 'days', 'day' at one, or `DAYS_START` when the count is null. */
  words: string;
}

export interface MomentumRetained {
  /**
   * Non-phoneme cards the brain has counted at least one natural conversational
   * use of, or null when there are none. A sound is not a phrase, which is the
   * phrasebook's own rule.
   *
   * Read through `evidenceOf`, so a card with no evidence block reads as zero
   * uses rather than throwing. See the header for why an established learner
   * can meet the start line over a full deck, and why one conversation fixes it.
   */
  count: number | null;
  /**
   * How many of those arrived in the last seven local days, or null when none
   * did.
   *
   * Dated by `addedAt`, which is exact for the common case and modest for the
   * rest: a phrase banked out of a conversation gets its card and its first use
   * in the same write, so arriving this week means used this week. A card added
   * months ago and first used this morning is not counted here. Undercounting
   * is the direction to be wrong in, and a `usedAt` field on the card is the
   * exact fix when it is worth changing core for.
   */
  thisWeek: number | null;
  /** 'Retained phrases'. */
  label: string;
  /** 'Active vocabulary bank'. */
  sub: string;
  /** 'phrases spoken naturally', singular at one, or `RETAINED_START` at none. */
  words: string;
  /** '+6 this week', or null when nothing arrived this week. */
  weekLine: string | null;
  /**
   * Up to `RETAINED_CHIPS` of the learner's own French, most used first. Empty
   * when there is none. The card's `front`, exactly as they said it.
   */
  chips: readonly string[];
  /** '+4 more' when there are more than the chips show, else null. */
  moreLine: string | null;
  /** `RETAINED_FOOT`, or null when there is nothing above it to explain. */
  foot: string | null;
  /** `RETAINED_LINK`, or null when there is no bank to review yet. */
  link: string | null;
}

export interface MomentumMastery {
  /**
   * Every time the deck asked for a phrase the learner had already produced
   * once: the sum of `reps - 1` plus the sum of `lapses`, over non-phoneme
   * cards with at least one success. A card nobody has ever got right is in
   * neither sum. See the header for why the first success is dropped.
   */
  asked: number;
  /** The ones that came back: the sum of `reps - 1` over the same cards. */
  right: number;
  /**
   * Right over asked, floored, or null below `MIN_REVIEWS_FOR_RECALL` and
   * whenever nothing has been asked at all.
   *
   * Floored rather than rounded, so a hundred per cent means there was no
   * lapse, not that there were few.
   */
  percent: number | null;
  /** 'Recall'. */
  label: string;
  /** '88%', or null while the figure is withheld. */
  percentLabel: string | null;
  /** 'of reviews', or `MASTERY_EARLY` while the figure is withheld. */
  words: string;
  /** One of `MASTERY_LINES`, or null while the figure is withheld. */
  line: string | null;
}

export interface MomentumGoal {
  /** Whole timed spoken minutes today. Zero is allowed, and is worded, not drawn. */
  minutes: number;
  /** What the learner asked for, from `dailyGoalOf`, or null if nobody asked them. */
  target: GoalMinutes | null;
  /** Whole minutes still to go, floored at zero, or null without a target. */
  remaining: number | null;
  /** How far along, 0 to 100, for the bar. Clamped, so an over-run never overflows it. */
  percent: number;
  /** "Today's speaking goal". */
  title: string;
  /** '6 / 10 min', or just the promise at zero minutes, or null without a target. */
  amount: string | null;
  /** The footer's left half: the invitation, what is left, or the warm line once it is met. */
  note: string;
  /** The footer's right half: '60%'. Null until there is a fraction to state. */
  percentLabel: string | null;
}

export interface Momentum {
  retained: MomentumRetained;
  days: MomentumDays;
  mastery: MomentumMastery;
  goal: MomentumGoal;
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
 * Days active.
 *
 * The count is a set size, which is what makes it monotone: entries are only
 * ever appended, and adding an entry can only leave the set the same size or
 * make it larger. Time passing adds nothing and removes nothing.
 */
/**
 * The last seven local days, oldest first, true where something happened.
 *
 * Exported for Profile's week (F561), which draws the same rail Home's days
 * card does from the same log, so the two pictures can never disagree about
 * which of the last seven days had French in them.
 */
export function weekRailFrom(activity: readonly { at: number }[], now: number): readonly boolean[] {
  const active = new Set<string>();
  for (const entry of activity) active.add(localDayKey(entry.at));
  return recentDayKeys(now, MOMENTUM_WEEK_DAYS).map((key) => active.has(key));
}

function daysFrom(activity: readonly ActivityEntry[], now: number): MomentumDays {
  const active = new Set<string>();
  for (const entry of activity) active.add(localDayKey(entry.at));
  const count = active.size === 0 ? null : active.size;

  return {
    count,
    week: weekRailFrom(activity, now),
    label: DAYS_LABEL,
    words: count === null ? DAYS_START : count === 1 ? 'day' : 'days',
  };
}

/** A sound is not a phrase. The phrasebook's rule, applied to both folds here. */
function isPhrase(card: ReviewCard): boolean {
  return card.kind !== 'phoneme';
}

/**
 * A phrase the learner has produced in a real conversation at least once.
 *
 * Exported because Practice's archive counts the same thing under the same
 * name. Two screens reading one predicate cannot tell a learner two different
 * numbers for "phrases retained", which is exactly what a second copy of this
 * one-line rule would eventually do.
 */
export function isRetained(card: ReviewCard): boolean {
  return isPhrase(card) && evidenceOf(card).convoUses >= 1;
}

/**
 * The learner's retained phrases, in the one order two screens may read.
 *
 * Most-used first, then newest, then by id, so the chips Home shows are stable
 * across renders rather than however the deck happened to be written. Exported
 * for the same reason `isRetained` is: My French features the top of this list
 * as the phrase it puts a name to, and a second comparator a screen away would
 * eventually feature a different phrase from the one Home called first. One
 * order, two readers.
 */
export function retainedOrder(deck: readonly ReviewCard[]): readonly ReviewCard[] {
  // Evidence is read once per card rather than inside the comparator, so a deck
  // of any size costs one pass and the sort compares plain numbers.
  return deck
    .filter(isRetained)
    .map((card) => ({ card, uses: evidenceOf(card).convoUses }))
    .sort((a, b) => {
      if (a.uses !== b.uses) return b.uses - a.uses;
      if (a.card.addedAt !== b.card.addedAt) return b.card.addedAt - a.card.addedAt;
      return a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0;
    })
    .map((entry) => entry.card);
}

/**
 * The phrases this learner has actually used in conversation.
 *
 * Sorted most-used first, then newest, then by id, so the two chips the hero
 * shows are the same two on every render rather than whatever order the deck
 * happened to be written in.
 */
function retainedFrom(deck: readonly ReviewCard[], now: number): MomentumRetained {
  // Each card's evidence is read once here rather than inside the comparator,
  // so a deck of any size costs one pass and the sort compares plain numbers.
  const used = deck
    .filter(isRetained)
    .map((card) => ({ card, uses: evidenceOf(card).convoUses }));
  const count = used.length === 0 ? null : used.length;

  const week = new Set(recentDayKeys(now, MOMENTUM_WEEK_DAYS));
  const recent = used.filter((entry) => week.has(localDayKey(entry.card.addedAt)));
  const thisWeek = recent.length === 0 ? null : recent.length;

  const ranked = retainedOrder(deck);
  const chips = ranked.slice(0, RETAINED_CHIPS).map((card) => card.front);
  const more = used.length - chips.length;

  return {
    count,
    thisWeek,
    label: RETAINED_LABEL,
    sub: RETAINED_SUB,
    words: count === null ? RETAINED_START : count === 1 ? 'phrase spoken naturally' : 'phrases spoken naturally',
    weekLine: thisWeek === null ? null : `+${thisWeek} this week`,
    chips,
    moreLine: more === 0 ? null : `+${more} more`,
    foot: count === null ? null : RETAINED_FOOT,
    link: count === null ? null : RETAINED_LINK,
  };
}

/**
 * How much of the deck comes back when it is asked for.
 *
 * `applyGrade` writes exactly one of the two counters on every grade: `again`
 * adds a lapse, `good` and `easy` add a rep. The first rep on any card is the
 * introduction that put the phrase there, so it is dropped, and a card that has
 * never had a success contributes nothing at all — neither its win, because it
 * has none, nor its lapses, because they were all taken while it was still
 * being introduced.
 */
function masteryFrom(deck: readonly ReviewCard[]): MomentumMastery {
  let right = 0;
  let lapses = 0;
  for (const card of deck) {
    if (!isPhrase(card) || card.reps < 1) continue;
    right += card.reps - 1;
    lapses += card.lapses;
  }
  const asked = right + lapses;

  // The floor already excludes nought. The guard stays beside it anyway,
  // because it is the only thing between a NaN and a learner's screen if
  // somebody ever lowers the floor.
  const percent = asked === 0 || asked < MIN_REVIEWS_FOR_RECALL ? null : Math.floor((100 * right) / asked);
  const line =
    percent === null
      ? null
      : percent >= RECALL_STEADY
        ? MASTERY_LINES.steady
        : percent >= RECALL_SETTLING
          ? MASTERY_LINES.settling
          : MASTERY_LINES.fresh;

  return {
    asked,
    right,
    percent,
    label: MASTERY_LABEL,
    percentLabel: percent === null ? null : `${percent}%`,
    // Not "recall": the tile above already says that, and a numeral wearing its
    // own label twice reads as a stutter. This says what the fraction is of.
    words: percent === null ? MASTERY_EARLY : 'of reviews',
    line,
  };
}

/**
 * The goal card's footer, in the one order that reads honestly.
 *
 * Nobody has chosen a promise, so the card asks for one in the profile row's
 * own words rather than inventing a number on their behalf. Nobody has spoken
 * yet today, so it says where the first minutes will land. A sitting happened
 * and recorded no duration, so it says that, rather than reading a real
 * conversation back to the learner as a nought. Only then does it count.
 *
 * `remaining` is null exactly when there is no target, which is why it stands
 * in for the promise here: one value decides the first branch and the last two,
 * so the footer and the numeral beside it can never disagree.
 */
function goalNote(remaining: number | null, minutes: number, untimed: boolean): string {
  if (remaining === null) return DAILY_GOAL_UNSET;
  if (minutes <= 0) return untimed ? GOAL_UNTIMED : GOAL_START;
  if (remaining === 0) return GOAL_MET;
  return `${remaining} more ${remaining === 1 ? 'minute' : 'minutes'} to reach daily cadence`;
}

/**
 * Today's speaking goal, always a card and never an accusation.
 *
 * Minutes are floored, never rounded up. This is a claim about time the learner
 * actually spent, and the direction to be wrong in is the modest one.
 */
function goalFrom(activity: readonly ActivityEntry[], profile: StoredProfile | null, now: number): MomentumGoal {
  const target = dailyGoalOf(profile);
  const today = localDayKey(now);

  let spokenMs = 0;
  let untimed = false;
  for (const entry of activity) {
    if (!SPOKEN_KINDS.includes(entry.kind)) continue;
    if (localDayKey(entry.at) !== today) continue;
    if (entry.durationMs === undefined) untimed = true;
    spokenMs += entry.durationMs ?? 0;
  }

  const minutes = Math.floor(spokenMs / 60_000);
  const remaining = target === null ? null : Math.max(0, target - minutes);
  // Computed from the whole minutes rather than the raw milliseconds, so the
  // bar, the percentage and "6 / 10 min" are three readings of one number
  // instead of three numbers that disagree at the edges.
  const percent = target === null || minutes <= 0 ? 0 : Math.min(100, Math.round((minutes / target) * 100));

  return {
    minutes,
    target,
    remaining,
    percent,
    title: GOAL_TITLE,
    amount: target === null ? null : minutes <= 0 ? `${target} min` : `${minutes} / ${target} min`,
    note: goalNote(remaining, minutes, untimed),
    percentLabel: target === null || minutes <= 0 ? null : `${percent}%`,
  };
}

/**
 * The whole block, folded from what the learner has actually done.
 *
 * Nothing is written, nothing is cached and nothing is read from a clock. All
 * four parts always arrive, because a learner should meet the four things this
 * app will claim about them before it can claim any of them; the fields inside
 * them go null one at a time, so a numeral is only ever drawn where there is a
 * number.
 */
export function momentumFrom(input: {
  activity: readonly ActivityEntry[];
  deck: readonly ReviewCard[];
  /** Null is allowed: Home asks before the profile has loaded, and no profile is no promise. */
  profile: StoredProfile | null;
  now: number;
}): Momentum {
  return {
    retained: retainedFrom(input.deck, input.now),
    days: daysFrom(input.activity, input.now),
    mastery: masteryFrom(input.deck),
    goal: goalFrom(input.activity, input.profile, input.now),
  };
}
