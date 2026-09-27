/**
 * Where a learner is in a practice sitting, and nothing about how it is going
 * (whole-app phase 2).
 *
 * A practice sitting is bounded: core's selector deals at most six distinct
 * phrases (`PRACTICE_QUEUE_CAP`). The drill used to give no sign of that bound,
 * so a short sitting read as an open queue with no place to stop. This says
 * which phrase of how many, and that is all it says.
 *
 * It counts distinct phrases, not asks. A miss that comes round again is the
 * same phrase, so it neither moves the learner back nor grows the total, and
 * the step never runs past the last phrase. The count is written in words,
 * because the drill draws no digit mid-sitting (a number there is the first
 * thing that reads as a score) and the words run well past core's cap. A
 * sitting too long to say in words, or already finished, gets no strip.
 *
 * Pure; the screen hands it the state and the held targets and draws the label.
 */

import type { DrillSessionState, PracticeTarget } from '@luvani/core';

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'] as const;

/** The longest sitting this can place a learner in, in words. */
export const SITTING_PROGRESS_MAX = WORDS.length;

export interface SittingProgress {
  /** The phrase on screen now, from one. */
  step: number;
  /** Distinct phrases in the sitting. */
  total: number;
  /** What the strip says, in words: "Phrase two of six". */
  label: string;
}

/** `state` may be null while the sitting is still being read; that draws nothing. */
export function sittingProgress(state: DrillSessionState | null, targets: readonly PracticeTarget[]): SittingProgress | null {
  const keys = new Set(targets.map((t) => t.phraseKey));
  const total = keys.size;
  if (state === null || state.finished || total === 0 || total > SITTING_PROGRESS_MAX) return null;
  const done = new Set(state.answered.map((a) => a.phraseKey).filter((key) => keys.has(key))).size;
  const step = Math.min(done + 1, total);
  return { step, total, label: `Phrase ${WORDS[step - 1]} of ${WORDS[total - 1]}` };
}
