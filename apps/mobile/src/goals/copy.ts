/**
 * Every word the goal screen and the goal rows say (Stage 4, 2026-09-25).
 *
 * Here rather than in the `.tsx`, for `myfrench/copy.ts`'s reason: there is no
 * renderer in this workspace, so a sentence in a component is one no sweep can
 * read. `goals/copy.test.ts` walks every line for the banned words, the em
 * dash, digits and the claims this surface may not make.
 *
 * What the words may say is the design's list: "Your goal", "You rehearsed
 * this on …", the pack's practice line, "You said you used this outside the
 * app." What they may not: "achieved", "mastered", "ready", a percentage, or a
 * conversation the learner did not open from the goal. The match wording is
 * `next.ts`'s, because it depends on the fit.
 */

/**
 * The screen's label over the learner's own words: the same two words the
 * My French row carries (`GOALS_ROW_LABEL` in myfrench/copy.ts), so the row
 * and the screen it opens name the goal alike.
 */
export const GOAL_LABEL = 'Your goal';

/** The label over the mission the goal suggests. */
export const GOAL_NEXT_LABEL = 'One thing to try';

/** The one primary action: open the suggested conversation. */
export const GOAL_START = 'Start this conversation';

/** The label over what came of the goal. */
export const GOAL_TRAIL_LABEL = 'What you did with it';

/** Nothing opened from this goal yet. Forwards, not an absence. */
export const GOAL_TRAIL_EMPTY = 'Conversations you open from here will show up here.';

/** The read has not answered yet. */
export const GOAL_LOADING = 'Finding what you did with this goal.';

/** The read failed. Not the same as having nothing. */
export const GOAL_UNREAD = 'Your goal activity could not be loaded just now.';

/** The one way on from a failed read. */
export const GOAL_RETRY = 'Try loading it once more';

/** A goal the learner no longer has, or a cold link to one. */
export const GOAL_GONE = 'This goal is not on your list any more. You can write goals in what your tutor remembers.';

/** The one way on from a goal that is gone. */
export const GOAL_GONE_OPEN = 'Open what your tutor remembers';

/** The quiet control for the learner's own report. */
export const USED_OUTSIDE_CONTROL = 'I used this outside the app';

/** The report, said back in the learner's own terms and nothing more. */
export const USED_OUTSIDE_SAID = 'You said you used this outside the app.';

/** The report could not be saved. */
export const USED_OUTSIDE_REFUSED = 'That could not be saved just now.';

/** What the newest sitting on the conversation showed, in the practice history's own words. */
export const GOAL_PRACTICE_LINE = {
  recalled: 'Recalled without choices',
  practised: 'Practised these phrases',
  attempted: 'Tried in practice',
} as const;

/** "You rehearsed this on 20 September." The date is the only digit on the screen. */
export function rehearsedOn(at: number): string {
  const date = new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `You rehearsed this on ${date}.`;
}

/** Every fixed line above, so one sweep can walk them all. */
export const GOAL_COPY: readonly string[] = [
  GOAL_LABEL,
  GOAL_NEXT_LABEL,
  GOAL_START,
  GOAL_TRAIL_LABEL,
  GOAL_TRAIL_EMPTY,
  GOAL_LOADING,
  GOAL_UNREAD,
  GOAL_RETRY,
  GOAL_GONE,
  GOAL_GONE_OPEN,
  USED_OUTSIDE_CONTROL,
  USED_OUTSIDE_SAID,
  USED_OUTSIDE_REFUSED,
  ...Object.values(GOAL_PRACTICE_LINE),
];
