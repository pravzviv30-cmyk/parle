/**
 * What a practice sitting may say about itself.
 *
 * What each target showed is the data store's rule alone (`completion.ts`,
 * `practiceOutcomes`), so the end card and the history can never disagree about
 * a recall. This file keeps only the two things the screen needs on top of it:
 * the one sentence the end card may say, and the empty-sitting guard.
 *
 * The guard is what the empty-completion bug needed: a sitting with no answered
 * work has nothing to finish. Core builds an empty queue as `finished: true`,
 * which is right for its state machine and wrong as a success signal, so the
 * screen asks `hasAnsweredWork` before it records, marks or celebrates.
 *
 * Pure. No store, no clock.
 */

import type { DrillSessionState, PracticeOutcome } from '@luvani/core';

/** Only real answered work can finish a sitting, or be recorded as one. */
export function hasAnsweredWork(state: Pick<DrillSessionState, 'answered'>): boolean {
  return state.answered.length > 0;
}

/**
 * The one sentence the end card may say, from the outcomes alone.
 *
 * 'recalled' is claimed only when at least one phrase was recalled; otherwise
 * the stronger word is simply not used. Nothing is said about a whole
 * conversation, about speaking, or about a level.
 */
export type SittingStatement = 'recalled-some' | 'practised' | 'coming-back' | 'nothing';

export function sittingStatement(outcomes: readonly { outcome: PracticeOutcome }[]): SittingStatement {
  if (outcomes.length === 0) return 'nothing';
  if (outcomes.some((o) => o.outcome === 'recalled')) return 'recalled-some';
  if (outcomes.some((o) => o.outcome === 'practised')) return 'practised';
  return 'coming-back';
}
