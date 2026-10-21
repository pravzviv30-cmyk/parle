/**
 * Teaching the controls at the moment they matter, without rebuilding the
 * manual one note at a time.
 *
 * The four-page intro that used to stand in front of the Tutor tab is demoted
 * (F52), and the obvious replacement is a small note next to each control. The
 * obvious replacement is also how a manual comes back: three notes on the first
 * screen is a carousel with the pages spread out, and a learner who dismissed
 * one and immediately met another has been given a tour, not a hint.
 *
 * So four rules, and every one of them is a rule about restraint:
 *
 * - **At most one on screen.** `showing` is a single id, not a list, so the type
 *   itself cannot hold two.
 * - **At most one NEW mark per session.** This is the rule that stops it being
 *   onboarding by instalments. The other two wait for the next conversation,
 *   and a learner who never needs them never meets them.
 * - **Each shown once, ever.** Seen-state is the one `coachMarks` key in
 *   `tutor/store.ts`, and the ids already read come in through `coachMarksAt`.
 * - **Never blocking.** Nothing here can return a state that requires an
 *   answer: a mark is dismissed by a tap and the scene carries on underneath it
 *   either way, so a learner mid-sentence is never waiting on a note.
 *
 * The copy rule is the product invariant, not a preference. A mark describes
 * what a control does. It never asks whether the learner is stuck, needs a
 * second, or is finding this hard, because a note that appears the moment
 * somebody hesitates and then asks about the hesitation is a remark on it.
 */

export type CoachMarkId = 'help' | 'moment' | 'english';

/**
 * The order they can arrive in, which is also the order the situations happen
 * in: the scene opens, the learner takes a turn, the tutor's French is sitting
 * on screen waiting to be understood.
 */
const SEQUENCE: readonly CoachMarkId[] = ['help', 'moment', 'english'];

/**
 * What each one says.
 *
 * Short, warm, and about the button. No question about how the learner is
 * getting on, and nothing that would read as an instruction they have to
 * follow.
 */
export const COACH_MARK_TEXT: Record<CoachMarkId, string> = {
  help: 'Help gives you the line, any time you want it.',
  moment: 'Give me a moment holds the conversation for you.',
  english: 'In English says the last line again, in English.',
};

export interface CoachMarkState {
  /** Every id this learner has read, including anything shown this session. */
  seen: readonly string[];
  /** The one on screen, or none. A single id, so two is unrepresentable. */
  showing: CoachMarkId | null;
  /** A new mark has already appeared this session. Only one ever does. */
  usedItsTurn: boolean;
}

/** Open a session from what the store remembers. */
export function coachMarksAt(seen: readonly string[]): CoachMarkState {
  return { seen, showing: null, usedItsTurn: false };
}

/**
 * What has happened in the scene so far.
 *
 * Flags rather than events, because the screen re-renders and an event that
 * fires per render is an event that fires forever. Each one is monotonic: once
 * the learner has spoken they have spoken.
 */
export interface CoachSignals {
  /** The first scene view has rendered. There is a Help control to point at. */
  sceneOpen: boolean;
  /** The learner has finished a turn of their own. */
  learnerSpoke: boolean;
  /** A French line from the tutor is on screen. */
  frenchLanded: boolean;
  /**
   * The voice-only controls are actually rendered.
   *
   * "In English" and "Slower" live behind the voice branch, so in the quiet
   * typed path they are not on screen at all. Pointing a text-mode learner at
   * them would teach a control that is not there, and worse, it would tell them
   * they are on the lesser path. Quiet mode is first-class here, not a
   * degraded fallback, so a mark for a control they cannot see simply waits.
   */
  voiceControlsShown: boolean;
}

/**
 * Fold the current situation into the state.
 *
 * Called with everything true that is true, in one go, rather than once per
 * moment: the caller is a render, not a stream, and folding in a fixed order
 * means an unusual session (a learner who types their first turn before the
 * French arrives) cannot reorder the marks.
 */
export function coachMarksAfter(state: CoachMarkState, signals: CoachSignals): CoachMarkState {
  const active: Record<CoachMarkId, boolean> = {
    help: signals.sceneOpen,
    moment: signals.learnerSpoke,
    // Never point at something that is not on screen. This is a rule about
    // where a control IS, not about whether its moment has come.
    english: signals.frenchLanded && signals.voiceControlsShown,
  };

  let next = state;
  for (const id of SEQUENCE) {
    if (!active[id]) continue;
    // One new mark per session, and one on screen at a time. Both checks come
    // before the seen list, because a mark that is blocked by either is not
    // being shown and must not be recorded as read.
    if (next.usedItsTurn || next.showing !== null) break;
    if (next.seen.includes(id)) continue;
    next = { seen: [...next.seen, id], showing: id, usedItsTurn: true };
  }
  return next;
}

/**
 * Any tap closes it.
 *
 * `seen` already carries the id from the moment it appeared, not from here: a
 * learner who read a note and then killed the app has read it, and showing it
 * again on the next launch would be the app failing to remember rather than the
 * learner failing to notice.
 */
export function dismissCoachMark(state: CoachMarkState): CoachMarkState {
  return { ...state, showing: null };
}
