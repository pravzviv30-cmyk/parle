/**
 * The greeting on Home, as a rule rather than as part of a screen.
 *
 * Home opened on one fixed line for a long time, and the line was
 * `Bonjour, you`. Then it was three words taking turns. It is seven now, and
 * the hour decides which of them are true, which turns a string into a
 * decision: which words this hour allows, which one is showing, for how long,
 * which one a still header rests on, and what a learner who never told us
 * their name is called. A decision living inside a component is a decision
 * nobody can run, so it lives here. No React, no clock read, no state: the
 * hour arrives as a timestamp and `useGreetingRotation.ts` owns both the clock
 * and the timers.
 *
 * ## Why the hour matters
 *
 * The founder was asked whether the greetings should be right for the time of
 * day and said yes, which is the only answer a French app can give. `Bonsoir`
 * at breakfast is not a stylistic slip, it is the app teaching a learner
 * something false about their own morning. So three words are true at any
 * hour, and the four that carry a time of day are only ever offered inside it.
 *
 * ## Why every word is 5 to 7 characters
 *
 * The header holds the word in a fixed slot sized by the widest word the pool
 * can produce, so a shorter word leaves a gap after it. The band is what keeps
 * that gap to about a word-space rather than a hole, and it is tested rather
 * than remembered.
 *
 * The two phase numbers were measured off the founder's mockup video. They are
 * the specification rather than a taste, which is why `GREETING_CYCLE_MS` is
 * written down as its own measurement and the test adds the phases up to meet
 * it. If the two ever disagree the video wins, and the suite says so before a
 * learner sees the drift.
 */

import { firstNameOf } from '../tutor/dashboard.ts';

/**
 * The hours a greeting is true in, on a 24-hour clock.
 *
 * `from` is inclusive and `to` is exclusive, and a window whose `from` is
 * after its `to` wraps around midnight. Evening is the reason: 18:00 to 04:59
 * is one stretch of a person's day and two stretches of a clock.
 */
export interface HourWindow {
  from: number;
  to: number;
}

/** One greeting: the word, the hours it is true in, and whether the hour rests on it. */
export interface Greeting {
  /** The word alone. The comma belongs to `greetingLead`, not to the word. */
  word: string;
  /** The hours this word is true in. Absent means any hour. */
  hours?: HourWindow;
  /** The one word its window rests on, for a still header and a screen reader. */
  rest?: true;
}

/**
 * The seven words, in the order the header plays them.
 *
 * French and English interleave, because the learner is greeted in the
 * language they came for and then met in their own, which is the whole app in
 * a header. Every word is 5 to 7 characters and the test holds that band.
 *
 * `Bonjour` and `Bonsoir` carry `rest`, so the word a still header shows is
 * always the French one and always right for the hour.
 */
export const GREETINGS: readonly Greeting[] = [
  { word: 'Salut' },
  { word: 'Bonjour', hours: { from: 5, to: 18 }, rest: true },
  { word: 'Hello' },
  { word: 'Coucou' },
  { word: 'Morning', hours: { from: 5, to: 12 } },
  { word: 'Bonsoir', hours: { from: 18, to: 5 }, rest: true },
  { word: 'Evening', hours: { from: 18, to: 5 } },
];

/**
 * The widest word the pool can produce, which is what sizes the header's slot.
 *
 * Four words are seven characters, and this is the widest of those four in the
 * display serif: a capital M and a descending g are wider than anything in
 * `Bonjour`, `Bonsoir` or `Evening`. It is named here rather than measured,
 * because a measurement would need a rendered line and this file has none.
 */
export const GREETING_WIDEST_WORD = 'Morning';

/**
 * The word a window rests on when its own is missing.
 *
 * Unreachable while every hour has exactly one resting word, which the test
 * checks at all twenty-four of them. It exists so a mistake in the table costs
 * a slightly wrong greeting rather than a header with a bare comma in it.
 */
const FALLBACK_REST_WORD = 'Bonjour';

/** The word sits still for this long before it starts to leave. */
export const GREETING_HOLD_MS = 3300;

/** The swipe: the word rises out of the slot as the next one rises into it. */
export const GREETING_SWIPE_MS = 450;

/**
 * Switch to switch, measured off the video rather than derived from the two
 * phases above. The test proves the two agree.
 */
export const GREETING_CYCLE_MS = 3750;

/**
 * The local hour of `now`, 0 to 23.
 *
 * A clock we cannot read is treated as midday. That is not a neutral default,
 * it is the safer wrong answer: `Bonjour` is ordinary at almost any hour a
 * learner is awake, and `Bonsoir` before breakfast teaches them something
 * untrue about their own morning.
 */
export function localHour(now: number): number {
  if (!Number.isFinite(now)) return 12;
  const hour = new Date(now).getHours();
  return Number.isFinite(hour) ? hour : 12;
}

/** Whether `hour` falls inside `window`, wrapping around midnight when it must. */
function withinWindow(hour: number, window: HourWindow | undefined): boolean {
  if (window === undefined) return true;
  const { from, to } = window;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/**
 * The greetings that are true at `now`, in the order the header plays them.
 *
 * Never empty: three of the seven carry no window at all, so the filter cannot
 * take them. The fallback is there so a future window on every word would cost
 * a slightly wrong greeting rather than a blank header.
 */
export function greetingPool(now: number): readonly Greeting[] {
  const hour = localHour(now);
  const open = GREETINGS.filter((greeting) => withinWindow(hour, greeting.hours));
  return open.length > 0 ? open : GREETINGS;
}

/**
 * Which word is showing after `elapsedMs` of rotation.
 *
 * Every awkward input answers with the first word rather than with a crash or
 * a `NaN` in the header: a clock that has not started, a clock that ran
 * backwards because the device time changed under us, and a pool holding a
 * single word, which would otherwise be a modulo by zero waiting to happen.
 */
export function greetingIndex(elapsedMs: number, count: number): number {
  if (!Number.isFinite(count) || count < 1) return 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / GREETING_CYCLE_MS) % Math.floor(count);
}

/**
 * The moving half of the greeting: the word, with the comma that joins it to a
 * name.
 *
 * The comma travels with the word rather than sitting in the header, because
 * the header holds the word in a slot that moves and the name still beside it.
 * A comma left behind would be a comma with nothing in front of it for half a
 * swipe. A learner who skipped the name question gets the bare word and no
 * dangling punctuation.
 */
export function greetingLead(word: string, firstName: string | null): string {
  return firstNameOf(firstName) === null ? word : `${word},`;
}

/**
 * The greeting a learner reads: the word, then their name when we have one.
 *
 * When we do not have one, the bare word. Not `Bonjour, you`, which is what
 * Home said before and which reads like the app forgot who it is talking to.
 * Skipping the name question is a choice a learner made, and the greeting
 * should look like it was written that way rather than like a gap.
 *
 * `firstNameOf` does the splitting, so a full name, a padded name and an empty
 * string all behave here exactly as they do on the tutor dashboard. One
 * name rule for the app, not two.
 */
export function greetingLine(word: string, firstName: string | null): string {
  const first = firstNameOf(firstName);
  return first === null ? word : `${word}, ${first}`;
}

/**
 * The greeting when nothing is allowed to move, and the hour's French word.
 *
 * Reduce motion gets this, and so does a screen reader, as one fixed label. A
 * header that renamed itself every 3.75 seconds and announced each new name
 * would be the most hostile thing this app could do to somebody listening to
 * it. It is French because the French word is the one Home has always rested
 * on, and it is the hour's French word because a still header is still a
 * header that has to be right about the time of day.
 */
export function greetingRest(firstName: string | null, now: number): string {
  const resting = greetingPool(now).find((greeting) => greeting.rest === true);
  return greetingLine(resting?.word ?? FALLBACK_REST_WORD, firstName);
}
