/**
 * The line a right answer's sheet shows under its headline (drill B v2,
 * UI-016; drill-b.md "Sheet", Right: "the line, its English and Hear it").
 *
 * Always the exercise's own authored French, never the learner's typing, so a
 * right sheet never repeats a typo back as the model. The English is the
 * exercise's own gloss, or null when it has none (listen and type). Own words
 * has its own outcome card and no line here; a translate into English shows
 * the French it came from, so Hear it still has French to say.
 *
 * Pure, so `sheetLine.test.ts` holds it.
 */
import type { DrillExercise } from '@luvani/core';

export interface SheetLine {
  readonly fr: string;
  readonly en: string | null;
}

/** The blank in a fill-blank sentence. */
const BLANK = /_{2,}/;

/**
 * The right sheet's line for `exercise`, answered with `value` (the index or
 * string the learner gave), or null when there is none to show.
 */
export function sheetLine(exercise: DrillExercise, value: string | number): SheetLine | null {
  switch (exercise.kind) {
    case 'fill-blank': {
      const word = typeof value === 'string' && exercise.options !== null ? value : exercise.accepted[0];
      return word === undefined ? null : { fr: exercise.sentence.replace(BLANK, word.trim()), en: exercise.en };
    }
    case 'best-sentence': {
      const c = exercise.candidates[exercise.correctIndex];
      return c === undefined ? null : { fr: c.fr, en: c.en };
    }
    case 'appropriate-reply': {
      // Several replies can be right: show the one the learner chose.
      const o = typeof value === 'number' ? exercise.options[value] : undefined;
      return o === undefined ? null : { fr: o.fr, en: o.en };
    }
    case 'tap-translate': {
      const fr = exercise.accepted[0];
      return fr === undefined ? null : { fr, en: exercise.en };
    }
    case 'listen-type':
      return { fr: exercise.fr, en: null };
    case 'translate':
      return { fr: exercise.fr, en: exercise.en };
    case 'repeat-this':
      return { fr: exercise.reference, en: exercise.referenceEn };
    case 'own-words':
      return null;
  }
}
