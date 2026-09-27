/**
 * What a practice sitting's end card may say about whether it was kept.
 *
 * Pure, and it writes nothing. The practice data store owns completion end to
 * end (`completion.ts`, `completePracticeSitting`): grades, XP, history and the
 * resume record, at most once per sitting id. This file only turns its status
 * into the sentence the learner reads, so a claim on the card can never be
 * stronger than what reached the disk.
 *
 * - `saved`: every write acknowledged (`completed`, or `already-completed` for
 *   a sitting that finished before). The card says what happens next.
 * - `saved-locally`: `kept`. The frozen plan is durable on this phone and will
 *   finish writing on the next try or launch, which is said as exactly that.
 * - `saved-outside-history`: completed, grades and XP durable, but the sitting
 *   is older than everything the bounded history keeps (`history: 'aged-out'`),
 *   so there is no history row and My French will not list it. The card says
 *   the practice was saved and that it sits outside the recent history, and
 *   promises nothing about My French. No timestamp is faked to squeeze it in.
 * - `not-saved`: `failed`, `account-changed`, or `nothing-to-save` for a
 *   sitting that did have answers. Nothing is claimed, and the one thing on
 *   offer is the same save again, which replays rather than recomputes.
 */

import type { PracticeCompletionResult, PracticeCompletionStatus } from './completion.ts';
import { PRACTICE_END } from './copy.ts';
import type { SittingStatement } from './sittingOutcome.ts';

export type SaveState = 'saved' | 'saved-outside-history' | 'saved-locally' | 'not-saved';

/**
 * The card's state from a completion result. The status decides whether it was
 * saved at all; for a completed sitting, the history field decides whether it
 * reached the recent history.
 */
export function saveStateOfResult(done: Pick<PracticeCompletionResult, 'status' | 'history'>): SaveState {
  const state = saveStateOf(done.status);
  return state === 'saved' && done.history === 'aged-out' ? 'saved-outside-history' : state;
}

export function saveStateOf(status: PracticeCompletionStatus): SaveState {
  switch (status) {
    case 'completed':
    case 'already-completed':
      return 'saved';
    case 'kept':
      return 'saved-locally';
    case 'failed':
    case 'nothing-to-save':
    case 'account-changed':
      return 'not-saved';
  }
}

export interface PracticeEndCard {
  title: string;
  body: string;
  /** Offer the same save again. Only when nothing is safe yet. */
  retry: boolean;
}

/**
 * The end card, whole. The statement about what was practised is only made
 * when the sitting is at least kept on this phone: a sitting that was not
 * saved says so first, and never claims a recall the history does not hold.
 */
export function practiceEndCard(saved: SaveState, statement: SittingStatement): PracticeEndCard {
  if (saved === 'not-saved') return { title: PRACTICE_END.notSaved, body: PRACTICE_END.notSavedBody, retry: true };
  // Aged out: saved, but not in the history My French reads. It says so, and
  // makes no claim about what the sitting showed that the history cannot back.
  if (saved === 'saved-outside-history') return { title: PRACTICE_END.savedOutsideHistory, body: PRACTICE_END.savedOutsideHistoryBody, retry: false };
  const title = statement === 'nothing' ? PRACTICE_END.empty : PRACTICE_END[statement];
  return { title, body: saved === 'saved-locally' ? PRACTICE_END.savedLocally : PRACTICE_END.after, retry: false };
}
