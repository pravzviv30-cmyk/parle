/**
 * "Also fine:" on a turned-over review card (2026-10-21 UI-008, artboard
 * B-ReviewReveal; founder decision, plan "Data slots").
 *
 * Review cards carry one answer. The drill bank's exercises for the same
 * phrase carry `accepted[]`, the French the drill already takes as right, so
 * the first of those that is not just the answer again (case, spacing and
 * punctuation aside) is the other way to say it. Only French answers count:
 * a French-to-English translation accepts English, so it is skipped. Nothing
 * is generated here, and a card with no such exercise shows no line.
 *
 * Pure, so `alsoFine.test.ts` holds it.
 */

import type { DrillExercise } from '@luvani/core';

/** Two lines that differ only by case, spacing, apostrophe shape or punctuation are the same line. */
function sameLine(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?;:«»" ]/g, ' ').replace(/\s+/g, ' ').trim();
  return norm(a) === norm(b);
}

/** The French the drill accepts for one exercise, or none when it accepts English or nothing. */
function frenchAccepted(exercise: DrillExercise): readonly string[] {
  switch (exercise.kind) {
    case 'tap-translate':
    case 'listen-type':
      return exercise.accepted;
    case 'translate':
      return exercise.direction === 'en-fr' ? exercise.accepted : [];
    default:
      return [];
  }
}

/**
 * Another accepted way to say `answer`, from the bank's exercises on the card
 * `cardId` (the deck's phrase key), or null.
 */
export function alsoFine(cardId: string, answer: string, bank: readonly DrillExercise[]): string | null {
  for (const exercise of bank) {
    if (exercise.phraseKey !== cardId) continue;
    for (const line of frenchAccepted(exercise)) {
      if (line.trim() !== '' && !sameLine(line, answer)) return line.trim();
    }
  }
  return null;
}
