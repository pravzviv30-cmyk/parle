import type { DrillExercise } from './types.ts';

/**
 * The one-line reason a miss shows beside the right answer (LEARN-017).
 *
 * It is the right item's own French and its own English, "je vais prendre
 * = I'll have", and nothing more. The exercise data carries a meaning, not a
 * grammar rule, so the line claims a meaning and never explains a rule it
 * cannot back. Null where the data has no English for the answer (listen-type)
 * or no one right string (own-words).
 */
export function missReason(exercise: DrillExercise, shown: string | null = null): string | null {
  // `shown` is the form the sheet shows (core's closest, the nearest accepted
  // answer), so the reason never names a different form from the one above it.
  const s = shown?.trim() ? shown : null;
  const line = (fr: string | undefined, en: string | undefined): string | null => {
    const f = fr?.trim() ?? '';
    const e = en?.trim() ?? '';
    return f === '' || e === '' ? null : `${f} = ${e}`;
  };
  switch (exercise.kind) {
    case 'best-sentence': {
      const right = exercise.candidates[exercise.correctIndex];
      return line(right?.fr, right?.en);
    }
    case 'appropriate-reply': {
      const first = exercise.acceptableIndexes[0];
      const right = first === undefined ? undefined : exercise.options[first];
      return line(right?.fr, right?.en);
    }
    case 'fill-blank': {
      const blank = s ?? exercise.accepted[0];
      return blank === undefined || !exercise.sentence.includes('___') ? null : line(exercise.sentence.replace('___', blank), exercise.en);
    }
    case 'tap-translate':
      return line(s ?? exercise.accepted[0], exercise.en);
    case 'translate':
      // en-fr shows French, fr-en shows English: the shown side replaces its own.
      return exercise.direction === 'en-fr' ? line(s ?? exercise.fr, exercise.en) : line(exercise.fr, s ?? exercise.en);
    case 'repeat-this':
      return line(s ?? exercise.reference, exercise.referenceEn);
    default:
      return null;
  }
}
