/**
 * A run of real passes in one sitting, as the living bar's glow reads it
 * (come alive, core loop section 2.2).
 *
 * Only an answer code judged moves it. A good answer and a typo the drill
 * accepted each add one; a miss sets it back to nothing, quietly, with no line
 * and no number. A repeat-this is the learner's own word that they said it, so
 * it neither extends the run nor ends it, and an own-words retry is an
 * invitation to try again, which leaves the run where it stood.
 *
 * The number never reaches the screen. The bar glows from `COMBO_GLOW_FROM`
 * and the answer sheet's line changes from the same point; nothing says how
 * many in a row, and nothing says when a run ended.
 *
 * Pure, so `combo.test.ts` holds it.
 */

import type { DrillExercise, OwnWordsDecision, SettledVerdict } from '@luvani/core';

/** How an own-words attempt was decided (core's `decideOwnWords`), when the answer was one. */
export type OwnWordsDecided = OwnWordsDecision;

/** From this many passes in a row, the bar glows and the sheet's good line becomes a run line. */
export const COMBO_GLOW_FROM = 3;

/** The run after one answer. */
export function comboAfter(
  previous: number,
  verdict: SettledVerdict,
  kind: DrillExercise['kind'],
  decided?: OwnWordsDecided,
): number {
  const before = Number.isSafeInteger(previous) && previous > 0 ? previous : 0;
  // A self-report is not a pass the code judged.
  if (kind === 'repeat-this') return before;
  if (kind === 'own-words') {
    if (decided === 'retry') return before;
    if (decided === 'good') return before + 1;
    return 0;
  }
  return verdict === 'miss' ? 0 : before + 1;
}

/** Whether a run this long shows the glow. */
export function comboGlows(combo: number): boolean {
  return combo >= COMBO_GLOW_FROM;
}
