/**
 * The out-of-time words, from one place (F911).
 *
 * Speak's card and band, the plan rows in Settings and Subscription, the live
 * refusal, Today's lead and the wall's account line all used to say the limit
 * their own way, and most never said when time came back. Every one of them
 * now asks this function. It takes only what the server said: the plan, the
 * seconds, whether a session may start, and the refill instant (`periodEnd`
 * from `/billing/status`, or `refillsAt` from a 402). The day and time are
 * core's own words on this phone's clock; nothing here invents a date, and the
 * seconds never reach the words.
 */

import { refillWhen, type Plan } from '@luvani/core';

import { dayAndMonthOf, freeBackLine, freshMinutesLine, PERIOD_LINES } from './planStatus.ts';

export type OutOfTimeInput = {
  plan: Plan;
  /** The server's reason, when it gave one. `insufficient-for-session` is "a little left". */
  reason: 'exhausted' | 'insufficient-for-session' | string | null;
  /** An ISO instant: `periodEnd` from billing status, or `refillsAt` from a 402. */
  refillsAt: string | null;
  now: number;
};

export type OutOfTimeWords = {
  title: string;
  /** "Not quite enough..." when a little is left; otherwise null. */
  lead: string | null;
  refill: string;
  offline: string;
  /** All of it, in order, as one paragraph. */
  message: string;
};

export const OUT_OF_TIME_WORDS = {
  freeTitle: "You've used your free conversation",
  paidTitle: "You've used this month's speaking time",
  shortTitle: 'Not quite enough time for a conversation',
  notQuiteEnough: 'There is a little speaking time left, but not quite enough for a whole conversation.',
  /** A free refill whose time the server did not give. True of every free row, the one that never refills included. */
  freeUnknown: 'Your free conversation is used for now.',
  offline: 'Until then, practise offline.',
  /** Offline, when no time is known: "until then" would promise one. */
  offlineUntimed: 'Practice and review still work offline.',
  /** Speak's card, after the message: what the learner keeps. */
  kept: 'Your phrases are all still here.',
} as const;

function instant(iso: string | null): Date | null {
  if (iso === null || iso.trim() === '') return null;
  const at = new Date(iso);
  return Number.isFinite(at.getTime()) ? at : null;
}

function refillFor(plan: Plan, refillsAt: string | null, now: number): string {
  const at = instant(refillsAt);
  if (plan === 'trial') return at === null ? OUT_OF_TIME_WORDS.freeUnknown : freeBackLine(refillWhen(at));
  if (at === null) return PERIOD_LINES.monthly;
  if (at.getTime() <= now) return PERIOD_LINES.freshSoon;
  const date = dayAndMonthOf(at.getTime());
  return date === null ? PERIOD_LINES.monthly : freshMinutesLine(date);
}

/** The words for a learner who cannot start a conversation for lack of time. */
export function outOfTimeWords(input: OutOfTimeInput): OutOfTimeWords {
  const short = input.reason === 'insufficient-for-session';
  const title = short ? OUT_OF_TIME_WORDS.shortTitle : input.plan === 'trial' ? OUT_OF_TIME_WORDS.freeTitle : OUT_OF_TIME_WORDS.paidTitle;
  const lead = short ? OUT_OF_TIME_WORDS.notQuiteEnough : null;
  const refill = refillFor(input.plan, input.refillsAt, input.now);
  const offline = input.plan === 'trial' && instant(input.refillsAt) === null ? OUT_OF_TIME_WORDS.offlineUntimed : OUT_OF_TIME_WORDS.offline;
  return { title, lead, refill, offline, message: [lead, refill, offline].filter((s): s is string => s !== null).join(' ') };
}

/** Whether a line already ends with the out-of-time words, so a period line is not added after it. */
export function endsOutOfTime(line: string): boolean {
  return line.endsWith(OUT_OF_TIME_WORDS.offline) || line.endsWith(OUT_OF_TIME_WORDS.offlineUntimed);
}

export const OUT_OF_TIME_COPY: readonly string[] = Object.values(OUT_OF_TIME_WORDS);
