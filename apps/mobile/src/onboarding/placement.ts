/**
 * Where a self-reported learner starts on the five stages (founder decision 5,
 * F917, 2026-10-29). Pure, and imports nothing that can reach the network, so
 * the plan page can read it before an account exists.
 *
 * The honesty rule: a placement is a starting point, never evidence. It moves
 * where the plan and the Journey say the learner is, and it drops the scenes
 * below it from the suggested order. It never marks a scene earned, never
 * credits an ability, and the stages below it read as skipped and still open
 * to visit, not done. `journey/journeyView.ts` `stagesFrom` keeps that rule.
 *
 *   - Brand new and a few words: no placement, so Starter.
 *   - I can get by: Basics. "Skip ahead" on the plan moves it to Everyday.
 *   - Feeling confident: Everyday.
 */

import type { StartLevel } from './preAccountDraft.ts';

export const PLACEMENTS = ['basics', 'everyday'] as const;
export type Placement = (typeof PLACEMENTS)[number];

export function isPlacement(value: unknown): value is Placement {
  return value === 'basics' || value === 'everyday';
}

/** The stage index a placement stands at (Starter 0, Basics 1, Everyday 2). */
export const PLACEMENT_STAGE: Readonly<Record<Placement, 1 | 2>> = { basics: 1, everyday: 2 };

/** The mission level a placement starts on. Used as the brain's low-confidence estimate. */
export const PLACEMENT_CEFR: Readonly<Record<Placement, 'A1' | 'A2'>> = { basics: 'A1', everyday: 'A2' };

/** The placement the level answer sets, with "Skip ahead" taken only from Basics. */
export function placementFor(level: StartLevel | null | undefined, skipAhead = false): Placement | null {
  if (level === 'getby') return skipAhead ? 'everyday' : 'basics';
  if (level === 'confident') return 'everyday';
  return null;
}

/** The stage index the plan shows: 0 with no placement. */
export function placementStage(placement: Placement | null | undefined): number {
  return placement ? PLACEMENT_STAGE[placement] : 0;
}

/** "Skip ahead" is offered only where it changes something: from Basics. */
export function canSkipAhead(level: StartLevel | null | undefined, skipAhead = false): boolean {
  return placementFor(level, skipAhead) === 'basics';
}
