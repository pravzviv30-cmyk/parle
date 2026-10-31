/**
 * The greeting on Today, as a rule rather than as part of a screen.
 *
 * One still line: the hour's French word, then the learner's first name, then a
 * full stop. "Bonsoir, Praveen." or, for a learner who skipped the name
 * question, "Bonsoir." No bare comma, and never "you".
 *
 * It rotated through seven words on a timer until 2026-09-27 (notebook Phase
 * 3). The design contract keeps only the orb and the highlighter moving, so the
 * pool, the cycle and the hook that drove them were retired. What survives is
 * the part that was always a rule: the hour decides the word, because `Bonsoir`
 * at breakfast teaches a learner something false about their own morning.
 *
 * No React, no clock read, no state: the hour arrives as a timestamp.
 */

import { firstNameOf } from '../tutor/dashboard.ts';

/**
 * The hours something is true in, on a 24-hour clock.
 *
 * `from` is inclusive and `to` is exclusive, and a window whose `from` is
 * after its `to` wraps around midnight. Evening is the reason: 18:00 to 04:59
 * is one stretch of a person's day and two stretches of a clock.
 */
export interface HourWindow {
  from: number;
  to: number;
}

/** Bonsoir from six in the evening until five in the morning. */
export const EVENING: HourWindow = { from: 18, to: 5 };

/**
 * The local hour of `now`, 0 to 23.
 *
 * A clock we cannot read is treated as midday. That is the safer wrong answer:
 * `Bonjour` is ordinary at almost any hour a learner is awake, and `Bonsoir`
 * before breakfast is not.
 */
export function localHour(now: number): number {
  if (!Number.isFinite(now)) return 12;
  const hour = new Date(now).getHours();
  return Number.isFinite(hour) ? hour : 12;
}

/** Whether `hour` falls inside `window`, wrapping around midnight when it must. */
export function withinWindow(hour: number, window: HourWindow): boolean {
  const { from, to } = window;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/** The hour's French word. */
export function greetingWord(now: number): 'Bonjour' | 'Bonsoir' {
  return withinWindow(localHour(now), EVENING) ? 'Bonsoir' : 'Bonjour';
}

/**
 * The greeting a learner reads: the word, their first name when we have one,
 * and a full stop.
 *
 * `firstNameOf` does the splitting, so a full name, a padded name and an empty
 * string behave here exactly as they do on the tutor dashboard.
 */
export function greetingLine(firstName: string | null, now: number): string {
  const first = firstNameOf(firstName);
  const word = greetingWord(now);
  return first === null ? `${word}.` : `${word}, ${first}.`;
}

/**
 * The question under the greeting, one per part of the day.
 *
 * The windows tile the whole clock with no gap and no overlap, which the suite
 * checks at all twenty-four hours. The evening window is the greeting's own, so
 * the word and the question below it can never describe two parts of one day.
 */
export const GREETING_SUBLINES: readonly { hours: HourWindow; line: string }[] = [
  { hours: { from: 5, to: 12 }, line: 'Ready to speak French this morning?' },
  { hours: { from: 12, to: 18 }, line: 'Ready to speak French today?' },
  { hours: EVENING, line: 'Ready to speak French tonight?' },
];

/** The hour's question. An unreadable clock lands on midday, the neutral one. */
export function greetingSubline(now: number): string {
  const hour = localHour(now);
  const match = GREETING_SUBLINES.find((subline) => withinWindow(hour, subline.hours));
  return match?.line ?? GREETING_SUBLINES[1]!.line;
}

/**
 * Today's header: "Bonjour, Name." or "Bonsoir, Name.", and the word alone
 * with no name. Direction A's sky (UI-015, founder 2026-10-30) brings back the
 * hour's word, superseding direction B's one word all day (2026-10-20, B5): the
 * sky follows the hour, so the word under it does too, from the same evening
 * window. It is drawn in two lines, the word with its comma and then the name;
 * `title` is the one line a screen reader says. The name is the app's own use
 * of it and goes nowhere else.
 */
export function homeGreeting(
  firstName: string | null,
  now: number,
): { word: 'Bonjour' | 'Bonsoir'; name: string | null; title: string } {
  const name = firstNameOf(firstName);
  const word = greetingWord(now);
  return { word, name, title: name === null ? `${word}.` : `${word}, ${name}.` };
}
