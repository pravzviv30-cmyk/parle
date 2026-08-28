/**
 * The gap between pressing Finish and the recap arriving.
 *
 * Finish is the one button on the win card that promises something specific:
 * the session's recap. What it actually did was dismiss the card, set a flag
 * and render nothing at all on it, so the learner was handed back the ordinary
 * scene — orb, transcript, a text box inviting them to keep talking — while the
 * conversation they had just ended wound down invisibly behind it. Up to
 * fifteen seconds of that, and then the bail fired and the screen changed on
 * its own.
 *
 * The wait is real and it is not a bug: `leave()` publishes the wrap-up and
 * disconnects, and the recap comes back over the same room, so the screen
 * cannot tear the room down and still receive what it promised. The agent is
 * assembling a recap and folding a learner profile in that window. What was
 * wrong was the silence, not the delay.
 *
 * So the predicate and the words live here, and the screen renders the answer.
 * Same reason as `waitingView.ts` and `live/connectingView.ts`: apps/mobile has
 * no renderer, so a state that is only a boolean inside a `.tsx` is a state
 * nothing can ask a question about, and this one was invisible for exactly that
 * long.
 *
 * What this deliberately does not do: name a number, show a bar, or say
 * anything about how the conversation went. The recap is where the session gets
 * described, and a wait that starts describing it is the app inventing a
 * verdict before the tutor has reached one.
 */

/** The way out, the same word every other wait in the app uses. */
export const LEAVE_LABEL = 'Leave';

/** What the learner was promised, said back to them while it is being made. */
export const RECAP_COMING = 'Putting your recap together…';

/**
 * The second line. Honest about there being a wait without counting it: a
 * number here would be a countdown, and the thing being counted is a model call
 * whose length nobody can promise.
 */
export const RECAP_COMING_NOTE = 'This takes a few seconds.';

export interface RecapWaitState {
  /** The learner pressed Finish and the screen is holding for the recap. */
  finishing: boolean;
  /** The recap is in. The screen has a whole surface for it and shows that instead. */
  recapArrived: boolean;
}

export interface RecapWaitSurface {
  /** The promise, restated. */
  headline: string;
  /** One quiet line under it. */
  note: string;
  /** The door. It is here for the same reason it is on every other wait. */
  leaveLabel: string;
}

/**
 * What the finish wait shows, or null when it is not the thing on the screen.
 *
 * `recapArrived` is checked here as well as in the screen's own ordering. The
 * screen returns the recap above this, so the second reading is belt and
 * braces, and it is the reading a test can hold: a wait that could outlive its
 * own answer is a screen that shows a spinner over a finished recap.
 */
export function recapWait({ finishing, recapArrived }: RecapWaitState): RecapWaitSurface | null {
  if (!finishing || recapArrived) return null;
  return { headline: RECAP_COMING, note: RECAP_COMING_NOTE, leaveLabel: LEAVE_LABEL };
}
