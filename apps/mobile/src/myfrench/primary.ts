/**
 * Which of the tab's two pill branches renders.
 *
 * DESIGN.md's rule is one primary per door, and it is counted per file rather
 * than loosened: `surfaceContract.test.ts` pins each tab at exactly the number
 * it draws. My French draws two and renders one, which is the shape F365
 * already established for Practice, and the count moves from one to two for
 * that reason and no other.
 *
 * The branch is decided here so the screen cannot decide it twice. A learner
 * whose deck can deal a line gets the line as the primary, because producing
 * French outranks navigating to a place to produce it. A learner whose deck
 * cannot yet deal one gets the next situation, exactly as the tab ships today,
 * so a first morning is never left without one clear thing to do.
 *
 * `primary.test.ts` holds the two mutually exclusive over every fixture, which
 * is what makes the count of two honest rather than a licence for a third.
 */

import type { MyFrench } from './model.ts';

export type Primary = { kind: 'line' } | { kind: 'situation' };

export function primaryFor(model: MyFrench): Primary | null {
  // The settled tier is shown and not asked for, so it carries no primary: a
  // card the scheduler is not asking for must not be dressed as a task.
  if (model.oneLine !== null && model.oneLine.askable) return { kind: 'line' };
  if (model.next !== null) return { kind: 'situation' };
  return null;
}
