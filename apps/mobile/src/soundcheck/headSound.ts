/**
 * Which sound the sound check opens on, above the line to say (F584).
 *
 * Revamp A moves the acoustic panel off My French and onto the head of this
 * screen, which is the place it belonged all along: the panel says how a sound
 * is made, and this is the one screen in the app where a learner is about to
 * make it. The panel itself is `myfrench/AcousticCard.tsx` and its content is
 * `myfrench/acoustic.ts`; all this decides is which sound it is about.
 *
 * The answer is the learner's most recent measured check, across every
 * situation, and it comes from nowhere else. A check is the only place in this
 * app where audio is compared against a known reference, so it is the only
 * honest source for "this is your sound" — which is exactly the reason My
 * French read it the same way. A sound picked from a mission's catalogue, or
 * from the line about to be said, would be a sound nobody has measured, and a
 * panel about it would be the invented measurement PEDAGOGY.md refuses.
 *
 * Null is a perfectly good answer and happens often: a learner's first check,
 * a run of self-guided attempts, a scorer that was unavailable. The screen
 * draws no panel at all rather than a frame with a gap in it, and the line to
 * say is unaffected either way.
 *
 * It is a plain module rather than three lines inside the screen because it is
 * a decision, and apps/mobile has no renderer: a rule inside a `.tsx` is a rule
 * nothing can ask a question about.
 */

import type { SoundCheckEvidence } from './model.ts';

/**
 * The IPA symbol of the newest check that named one, or null.
 *
 * A sound belongs to the learner rather than to the scene it was noticed in, so
 * this reaches across every situation. Rows that named nothing are skipped
 * rather than being allowed to hide an older row that did: a self-guided
 * attempt this morning is not evidence that yesterday's measured sound stopped
 * being worth practising.
 *
 * `at` is a clock reading off a device, so it can be anything. The sort is a
 * plain descending compare, which is total over the numbers a disk can hold,
 * and a row with no usable symbol is dropped before it is ever compared.
 */
export function headSound(checks: readonly SoundCheckEvidence[]): string | null {
  const named = checks.filter((check) => check.phoneme !== null && check.phoneme !== '');
  const newest = [...named].sort((a, b) => b.at - a.at)[0];
  return newest?.phoneme ?? null;
}
