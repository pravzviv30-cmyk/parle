/**
 * The greeting on Home, as a rule rather than as part of a screen.
 *
 * Home opened on one fixed line for a long time, and the line was
 * `Bonjour, you`. The founder's mockup opens on three words taking turns
 * instead, which turns a string into a decision: which word is showing, for
 * how long, and what a learner who never told us their name is called. A
 * decision living inside a component is a decision nobody can run, so it lives
 * here. No React, no clock read, no state: time arrives as elapsed
 * milliseconds and `useGreetingRotation.ts` owns the timers.
 *
 * The four phase numbers were measured off the mockup video frame by frame at
 * 50ms resolution. They are the specification rather than a taste, which is
 * why `GREETING_CYCLE_MS` is written down as its own measurement and the test
 * adds the phases up to meet it. If the two ever disagree the video wins, and
 * the suite says so before a learner sees the drift.
 */

import { firstNameOf } from '../tutor/dashboard.ts';

/**
 * The three words, in the order the video plays them.
 *
 * French first, English last: the learner is greeted in the language they came
 * for and then met in their own, which is the whole app in three words.
 */
export const GREETINGS: readonly string[] = ['Salut', 'Bonjour', 'Hello'];

/** The word sits fully visible for this long before it starts to leave. */
export const GREETING_HOLD_MS = 2800;

/** The fade out. Opacity only; nothing slides. */
export const GREETING_OUT_MS = 250;

/**
 * The header is empty for this long between the words.
 *
 * Short, and load-bearing. The blank is what makes the change read as one word
 * replacing another rather than a single word flickering.
 */
export const GREETING_BLANK_MS = 200;

/** The fade in, slower than the fade out so the new word arrives gently. */
export const GREETING_IN_MS = 500;

/**
 * Switch to switch, measured off the video rather than derived from the four
 * phases above. The test proves the two agree.
 */
export const GREETING_CYCLE_MS = 3750;

/**
 * The neutral register. Bonjour is the one word DESIGN.md already calls Home's
 * French flourish, so a learner who has asked for less movement, or who is
 * hearing the header read out, gets the line the app already had.
 */
const REST_WORD = 'Bonjour';

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
 * The greeting when nothing is allowed to move.
 *
 * Reduce motion gets this, and so does a screen reader, as one fixed label. A
 * header that renamed itself every 3.75 seconds and announced each new name
 * would be the most hostile thing this app could do to somebody listening to
 * it.
 */
export function greetingRest(firstName: string | null): string {
  return greetingLine(REST_WORD, firstName);
}
