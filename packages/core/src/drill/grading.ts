/**
 * Grading one drill answer.
 *
 * Three verdicts instead of two because a slipped finger and a missing memory
 * are different events. 'typo' accepts the answer — the phrase was known, the
 * keyboard disagreed — while still naming the exact spelling so the slip does
 * not quietly fossilise. Collapsing both into 'miss' is how drills end up
 * punishing typing skill instead of French.
 *
 * The typo window is deliberately narrow: one Damerau-Levenshtein edit, words
 * of five letters or more only, and never when the slip lands on another real
 * word from the same exercise. In a four-letter word one edit is a third of the
 * word, and a "typo" that spells a different offered answer is far more likely
 * a confusion between the two than a mistyping of one — Duolingo's rule, kept
 * because it is right.
 *
 * Free text is compared through the same `normalise` the session engine uses,
 * so a dropped accent or apostrophe can never fail an answer here that a spoken
 * session would have accepted.
 */

import { normalise } from '../lessons/types.ts';
import { damerauLevenshtein, TYPO_MAX_DISTANCE, TYPO_MIN_LENGTH } from '../text/distance.ts';
import type { DrillExercise } from './types.ts';

export type DrillVerdict = 'good' | 'typo' | 'miss';

export interface GradeResult {
  verdict: DrillVerdict;
  /**
   * The accepted answer nearest to what the learner gave, in its real spelling,
   * for showing "On dit: «…»". Null only for index-based exercises answered
   * correctly, where there is nothing to point at.
   */
  closest: string | null;
}

// The typo window and the distance itself now live in ../text/distance.ts, so the
// spoken path can hold itself to exactly the same standard. Re-exported here
// because this is where callers have always found them.
export { damerauLevenshtein, sameWord, TYPO_MIN_LENGTH, TYPO_MAX_DISTANCE } from '../text/distance.ts';

function acceptedFor(exercise: DrillExercise): string[] {
  switch (exercise.kind) {
    case 'fill-blank':
    case 'tap-translate':
    case 'listen-type':
    case 'translate':
      return exercise.accepted;
    case 'repeat-this':
      return [exercise.reference];
    case 'best-sentence':
    case 'appropriate-reply':
      return [];
  }
}

/**
 * The exercise's own words a typo must not land on: the other accepted answers
 * and every option or token offered on screen. An answer that exactly spells
 * one of these is a choice between real words, not a slip in one of them.
 */
function realWordSet(exercise: DrillExercise): Set<string> {
  const words = acceptedFor(exercise).map(normalise);
  if (exercise.kind === 'fill-blank' && exercise.options) words.push(...exercise.options.map(normalise));
  if (exercise.kind === 'tap-translate') words.push(...exercise.tokens.map(normalise));
  return new Set(words);
}

function gradeFreeText(exercise: DrillExercise, answer: string): GradeResult {
  const said = normalise(answer);
  const accepted = acceptedFor(exercise);

  let closest: string | null = null;
  let closestDistance = Infinity;
  for (const candidate of accepted) {
    const target = normalise(candidate);
    if (said === target) return { verdict: 'good', closest: candidate };
    const distance = damerauLevenshtein(said, target);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }

  if (said.length === 0 || closest === null) return { verdict: 'miss', closest };

  const nearTarget = normalise(closest);
  const isTypo =
    closestDistance <= TYPO_MAX_DISTANCE &&
    // Both the answer and its target must clear the length bar — with one edit
    // between them they differ by at most a letter, but the bar belongs to the
    // word being learned, not to whichever string happens to be longer.
    said.length >= TYPO_MIN_LENGTH &&
    nearTarget.length >= TYPO_MIN_LENGTH &&
    // A slip that lands exactly on another word from this exercise is a miss:
    // they picked the other word, they did not mistype this one.
    ![...realWordSet(exercise)].some((w) => w !== nearTarget && w === said);

  return { verdict: isTypo ? 'typo' : 'miss', closest };
}

/**
 * Grade one answer against one exercise.
 *
 * Index answers are exact — there is no such thing as a typo when tapping a
 * card. Free text goes through normalisation, the typo window, and the
 * real-word rejection described at the top of the file. An answer of the wrong
 * shape for the exercise (text where an index belongs, or the reverse) is a
 * miss, never a crash: this function also grades machine-built exercises and
 * must stay deterministic in the face of bad input.
 */
export function gradeAnswer(exercise: DrillExercise, answer: string | number | number[]): GradeResult {
  switch (exercise.kind) {
    case 'best-sentence': {
      if (typeof answer !== 'number') return { verdict: 'miss', closest: exercise.candidates[exercise.correctIndex]?.fr ?? null };
      if (answer === exercise.correctIndex) return { verdict: 'good', closest: null };
      return { verdict: 'miss', closest: exercise.candidates[exercise.correctIndex]?.fr ?? null };
    }

    case 'appropriate-reply': {
      // Several replies can be right, and the UI may allow picking more than
      // one — a set is good only when every choice in it would have been.
      const chosen = typeof answer === 'number' ? [answer] : Array.isArray(answer) ? answer : [];
      const ok = chosen.length > 0 && chosen.every((i) => exercise.acceptableIndexes.includes(i));
      if (ok) return { verdict: 'good', closest: null };
      const first = exercise.acceptableIndexes[0];
      return { verdict: 'miss', closest: first === undefined ? null : (exercise.options[first]?.fr ?? null) };
    }

    case 'fill-blank':
    case 'tap-translate':
    case 'listen-type':
    case 'translate':
    case 'repeat-this':
      return gradeFreeText(exercise, typeof answer === 'string' ? answer : '');
  }
}
