/**
 * The end scene's "still settling" marks and the assisted retry they offer
 * (LEARN-018).
 *
 * A phrase is settled when every exercise on it in this sitting came out on
 * the first ask: the same notion of right first time as `drill/firstTry.ts`,
 * so a first-try typo is settled (a slipped finger, not a missing memory).
 * Right only after a miss, or not right at all, is still settling. The unit is
 * the phrase, not the exercise, because the end scene lists phrases and a
 * phrase drilled twice is only as settled as its worse exercise (core
 * `summarise` uses the same worse-speaks rule for grades).
 *
 * Own words and repeat-this follow the same line through core's outcome:
 * an own-words "good" on the first ask is settled, a reveal or a retry is not;
 * repeat-this is graded like any other kind and claims no pronunciation.
 * Phrases left unanswered (the learner left early) get no mark and no retry:
 * they simply stay due.
 *
 * The retry is practice with the answer already seen. It writes nothing:
 * no grades (the first sitting already graded the phrase, assisted or again,
 * and a second write would double a lapse or erase one), no evidence, no
 * first-try count, no XP, no activity day and no history event. Its own end
 * shows Done only.
 *
 * Pure. No React, no store.
 */

import type { AnsweredExercise, DrillExercise } from '@luvani/core';

export type SettledMark = 'settled' | 'still-settling';

export const SETTLED_LABEL = 'Settled';
export const STILL_SETTLING_LABEL = 'Still settling';

/** The end scene's button. Hidden when nothing is still settling. */
export function retryButtonLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? 'Practise the one still settling' : 'Practise the ones still settling';
}

function firstTryRight(a: AnsweredExercise): boolean {
  return a.attempts === 1 && a.outcome !== 'unresolved';
}

/** Each answered phrase, in the order it was first answered, with its mark. */
export function settledMarks(answered: readonly AnsweredExercise[]): { phraseKey: string; mark: SettledMark }[] {
  const marks = new Map<string, SettledMark>();
  for (const a of answered) {
    const held = marks.get(a.phraseKey);
    if (held === 'still-settling') continue;
    marks.set(a.phraseKey, firstTryRight(a) ? 'settled' : 'still-settling');
  }
  return [...marks].map(([phraseKey, mark]) => ({ phraseKey, mark }));
}

/** The phrase keys still settling, in end-scene order. */
export function stillSettling(answered: readonly AnsweredExercise[]): string[] {
  return settledMarks(answered)
    .filter((m) => m.mark === 'still-settling')
    .map((m) => m.phraseKey);
}

export interface RetrySitting {
  /** The exercises to ask again: the ones on each phrase that did not come out first time. */
  exercises: DrillExercise[];
  phraseKeys: string[];
  /** Every right answer here is help, never independent recall (LEARN-003). */
  assisted: true;
  countsFirstTry: false;
  xp: 0;
  /** No grade, evidence, activity day or history event. */
  writesProgress: false;
  /** The retry's own end shows Done only. */
  canRetryAgain: false;
}

/**
 * The retry for a finished sitting, or null when there is nothing to retry or
 * this sitting was itself a retry.
 *
 * `exercises` is every exercise the sitting asked (the ones `answered` refers
 * to by id). An exercise no longer to hand is skipped rather than invented.
 */
export function retrySitting(
  answered: readonly AnsweredExercise[],
  exercises: readonly DrillExercise[],
  opts: { isRetry: boolean },
): RetrySitting | null {
  if (opts.isRetry) return null;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const keys = new Set(stillSettling(answered));
  const picked: DrillExercise[] = [];
  const seen = new Set<string>();
  for (const a of answered) {
    if (!keys.has(a.phraseKey) || firstTryRight(a) || seen.has(a.id)) continue;
    const e = byId.get(a.id);
    if (!e) continue;
    seen.add(a.id);
    picked.push(e);
  }
  if (picked.length === 0) return null;
  const phraseKeys = [...new Set(picked.map((e) => e.phraseKey))];
  return { exercises: picked, phraseKeys, assisted: true, countsFirstTry: false, xp: 0, writesProgress: false, canRetryAgain: false };
}

/** What a retry's end scene shows: no first-try tile, no XP, Done only. */
export function retryEnd(): { firstTry: null; xp: 0; actions: readonly ['done'] } {
  return { firstTry: null, xp: 0, actions: ['done'] };
}
