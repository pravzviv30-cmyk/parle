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

/**
 * How full the sitting's living bar is: distinct phrases settled over distinct
 * phrases in the sitting, from 0 to 1, and nothing else (README Part 5.E,
 * "LivingBar in sittings, position only, no digits").
 *
 * A miss that comes round again is the same phrase, so it neither moves the
 * bar back nor grows the total, and the bar only ever fills. It still answers
 * once the sitting has finished, so the last answer fills it. Null, so no bar
 * is drawn, while the sitting is being read, when it holds fewer than two
 * phrases (one phrase has nowhere to go), or when it holds more than the words
 * strip can say (`SITTING_PROGRESS_MAX`), the same bound the strip keeps.
 *
 * `sittingFill` places a practice sitting against its held targets, the same
 * count the strip says in words. `queueFill` places an ordinary sitting, whose
 * phrases are whatever its queue and its answers hold.
 */
export function sittingFill(state: DrillSessionState | null, targets: readonly PracticeTarget[]): number | null {
  if (state === null) return null;
  return fillOf(new Set(targets.map((t) => t.phraseKey)), state);
}

export function queueFill(state: DrillSessionState | null): number | null {
  if (state === null) return null;
  return fillOf(new Set([...state.answered.map((a) => a.phraseKey), ...state.queue.map((e) => e.phraseKey)]), state);
}

/** The fewest phrases a sitting holds for a bar to mean anything. */
export const FILL_LEAST = 2;

function fillOf(keys: ReadonlySet<string>, state: DrillSessionState): number | null {
  if (keys.size < FILL_LEAST || keys.size > SITTING_PROGRESS_MAX) return null;
  const done = new Set(state.answered.map((a) => a.phraseKey).filter((key) => keys.has(key))).size;
  return Math.min(1, done / keys.size);
}
