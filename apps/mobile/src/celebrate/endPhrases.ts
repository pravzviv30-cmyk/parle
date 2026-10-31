/**
 * The end scene's phrase list (drill-b.md, Screens and states 10; LEARN-018):
 * each phrase the sitting answered, in the order it was first answered, with
 * its French for Hear it and its mark from `practice/stillSettling.ts`.
 *
 * The French is always the exercise's own authored line (`drill/sheetLine.ts`),
 * never the learner's typing. A phrase whose exercise is no longer to hand, or
 * has no French line, still gets its mark and no Hear it.
 *
 * Pure, so `endPhrases.test.ts` holds it.
 */
import type { AnsweredExercise, DrillExercise } from '@luvani/core';

import { sheetLine } from '../drill/sheetLine.ts';
import { settledMarks, type SettledMark } from '../practice/stillSettling.ts';

export interface EndPhrase {
  readonly phraseKey: string;
  /** The French to show and hear, or null when none is to hand. */
  readonly fr: string | null;
  readonly mark: SettledMark;
}

/** An exercise's own French line: the right answer, never an attempt. */
export function phraseFrench(exercise: DrillExercise): string | null {
  if (exercise.kind === 'own-words') return exercise.fr;
  const value = exercise.kind === 'appropriate-reply' ? (exercise.acceptableIndexes[0] ?? 0) : exercise.kind === 'fill-blank' ? (exercise.accepted[0] ?? '') : 0;
  return sheetLine(exercise, value)?.fr ?? null;
}

export function endPhrases(answered: readonly AnsweredExercise[], exercises: readonly DrillExercise[]): EndPhrase[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const firstOf = new Map<string, DrillExercise>();
  for (const a of answered) {
    const e = byId.get(a.id);
    if (e !== undefined && !firstOf.has(a.phraseKey)) firstOf.set(a.phraseKey, e);
  }
  return settledMarks(answered).map(({ phraseKey, mark }) => {
    const e = firstOf.get(phraseKey);
    return { phraseKey, fr: e === undefined ? null : phraseFrench(e), mark };
  });
}
