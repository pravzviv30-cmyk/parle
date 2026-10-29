/**
 * The words the leave sheet says before a learner abandons a metered room.
 *
 * Held here, not in the two live screens, so there is exactly one place that
 * decides what the confirmation says and one place a test can ask whether it is
 * honest. The sheet itself is `ConfirmSheet` in `layout.tsx`, which draws the
 * safe answer first; this only chooses the sentences, by which room is open.
 *
 * The rules mid-session hold at the door too: no number, no remark on how long
 * the learner took, nothing about a score. What it may say, and does, is the one
 * true cost of leaving, which is that the minutes stop counting here. That is a
 * fact about the meter and the app's to state, not a judgement on the learner.
 */

/** Which metered room the learner is about to leave. */
export type LeaveRoom = 'lesson' | 'conversation';

export interface LeaveConfirmCopy {
  /** The sheet's heading, a question. */
  title: string;
  /** The one honest line: the meter stops, and the room keeps. */
  body: string;
  /** The safe answer, and the sheet's primary action. */
  stay: string;
  /** The way out, the same word every metered surface uses. */
  leave: string;
}

/** The conversation body once the learner has replied: Leave keeps the work (F905). */
export const LEAVE_KEEPS_WORK = "We'll keep the lines you reached and count your minutes.";

/** What the leave sheet says for the room that is open. */
export function leaveConfirmCopy(room: LeaveRoom, learnerReplies = 0): LeaveConfirmCopy {
  if (room === 'lesson') {
    return {
      title: 'Leave the lesson?',
      body: 'Your minutes stop here. The lesson will be here when you come back.',
      stay: 'Stay',
      leave: 'Leave',
    };
  }
  return {
    title: 'Leave the conversation?',
    body: learnerReplies > 0 ? LEAVE_KEEPS_WORK : 'Your minutes stop here. You can start another one any time.',
    stay: 'Stay',
    leave: 'Leave',
  };
}
