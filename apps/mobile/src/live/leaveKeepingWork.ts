/**
 * Leaving a conversation with the work kept (F905, founder decision 2026-10-28).
 *
 * Leave used to close the room at once, and the agent's recap was then
 * published into a closed room: nothing saved to practice, no minutes counted.
 * Once the learner has replied, Leave does what Finish does instead: it keeps
 * the room, asks for the recap and waits a short while. With no reply there is
 * nothing to keep, so Leave stays instant. Also used when a typed room is
 * switched to voice.
 */

import type { TurnLine } from './turns.ts';

/** How long a Leave waits for the recap before the ordinary exit. */
export const LEAVE_RECAP_WAIT_MS = 8_000;

/**
 * The learner's own replies in this room: confirmed typed or spoken lines.
 * Tutor lines, narration, rescues and a topic pick are never counted. Only "any at all"
 * is decided from this, so the transcript's length cap does not matter.
 */
export function learnerRepliesInRoom(turns: readonly Pick<TurnLine, 'who' | 'topic'>[]): number {
  return turns.filter((t) => t.who === 'learner' && t.topic !== true).length;
}

/**
 * A learner line for the transcript, marked as a topic pick while the choosing
 * screen is up, the same rule the agent's `learnerReplies` follows.
 */
export function learnerLine(line: Pick<TurnLine, 'fr' | 'frWritten' | 'en'>, choosing: boolean): Omit<TurnLine, 'id'> {
  return choosing ? { who: 'learner', ...line, topic: true } : { who: 'learner', ...line };
}

export interface LeaveState {
  learnerReplies: number;
  /** A safety stop keeps its one way out and saves nothing. */
  stopped: boolean;
  /** A report saved in the room leaves through its own card. */
  reportHeld: boolean;
  /** A recap already here needs no waiting for. */
  recapArrived: boolean;
}

/** Whether Leave should keep the room and wait for the recap. */
export function leaveKeepsWork(state: LeaveState): boolean {
  return state.learnerReplies > 0 && !state.stopped && !state.reportHeld && !state.recapArrived;
}
