/**
 * Leaving a conversation with the work kept (F905, founder decision 2026-10-28).
 *
 * Leave used to close the room at once, and the agent's recap was then
 * published into a closed room: nothing saved to practice, no minutes counted.
 * Once the learner has replied, Leave does what Finish does instead: it keeps
 * the room, asks for the recap and waits a short while. With no reply there is
 * nothing to keep, so Leave stays instant.
 */

import { conversationXp } from '@luvani/core';
import type { TurnLine } from './turns.ts';

/** How long a Leave waits for the recap before the ordinary exit. */
export const LEAVE_RECAP_WAIT_MS = 8_000;

/**
 * A learner line for the transcript, marked as a topic pick while the choosing
 * screen is up, the same rule the agent's `learnerReplies` follows.
 */
export function learnerLine(line: Pick<TurnLine, 'fr' | 'frWritten' | 'en'>, choosing: boolean): Omit<TurnLine, 'id'> {
  return choosing ? { who: 'learner', ...line, topic: true } : { who: 'learner', ...line };
}

export interface LeaveState {
  /** Agent-confirmed learner replies in this scene (the hook's `sceneReplies`), never an optimistic typed line. */
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

/**
 * The XP a Leave whose recap never came settles locally (F905): the base a
 * conversation earns with no phrases. Above zero on purpose, because a zero
 * XP write records no minutes, and the sheet promised them.
 */
export const LOCAL_SETTLE_XP = conversationXp({ phraseCount: 0, unassistedRate: 0 });

export type LeaveAction = { kind: 'request-recap' } | { kind: 'teardown' } | { kind: 'settle-local'; xp: number };

/** The leave sheet's commit: keep the room and ask for the recap, or the ordinary teardown. */
export function leaveOnConfirm(state: LeaveState): LeaveAction[] {
  return leaveKeepsWork(state) ? [{ kind: 'request-recap' }] : [{ kind: 'teardown' }];
}

/**
 * The recap a Leave waited for never came. The sheet said the minutes count,
 * so after a confirmed reply they are settled here, then the ordinary teardown
 * (which banks whatever lines it can recover).
 */
export function leaveOnTimeout(state: { confirmedReplies: number; stopped: boolean; recapArrived: boolean }): LeaveAction[] {
  if (state.confirmedReplies > 0 && !state.stopped && !state.recapArrived) {
    return [{ kind: 'settle-local', xp: LOCAL_SETTLE_XP }, { kind: 'teardown' }];
  }
  return [{ kind: 'teardown' }];
}
