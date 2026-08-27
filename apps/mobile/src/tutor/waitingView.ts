/**
 * The room is open and the tutor has not said anything yet.
 *
 * Both live screens have this state and both wrote it out by hand: a spinner,
 * one line of copy, a door. `ConvoScreen` reaches it at `if (!view)` and
 * `LiveSessionScreen` at `if (!live.prompt)`, and because both are early
 * returns, everything further down the component never runs.
 *
 * That is how F145 happened. The redirect banner sits below both of those
 * returns, so a safety redirect published while the first scene was still being
 * built left the learner looking at "One moment" while the sentence the tutor
 * had just spoken was never drawn anywhere. Five of the nine decisions the
 * agent can make are redirects, so this was the common half of the surface, not
 * a spare branch. A stop was never affected: its whole-screen surface is
 * returned first on both screens, deliberately.
 *
 * The fix is not "remember to add the banner to that branch too". It is to stop
 * the waiting state being a shape a screen assembles for itself. This module
 * hands back everything that state shows, the redirect included, so a screen
 * that renders the waiting view renders the banner with it or renders nothing.
 *
 * Same move as `choosingView.ts` and `live/thinking.ts`, and for the same
 * reason: apps/mobile has no renderer, so a decision inside a `.tsx` is a
 * decision nothing can ask a question about.
 */

import type { SafetySurface } from './safetyView.ts';
import { TUTOR_NAME } from './tutorName.ts';

/** The redirect arm of the surface, named once so the screens can hold it. */
export type RedirectSurface = Extract<SafetySurface, { kind: 'redirect' }>;

/**
 * Before the watchdog has decided anything is wrong. Deliberately vague: the
 * tutor may be about to speak, and naming a fault that has not happened is how
 * a learner gets told their session is broken while it is still fine.
 */
export const ONE_MOMENT = 'One moment…';

/** The one door out of the waiting state. */
export const LEAVE_LABEL = 'Leave';

export interface WaitingState {
  /** The hook's watchdog has waited long enough to say who is missing. */
  waitingForTutor: boolean;
  /** The safety decision as a surface, from `safetySurface`. */
  safety: SafetySurface;
}

export interface WaitingView {
  /** The one line under the spinner. */
  headline: string;
  /** The way out, always present: nobody is stranded in here. */
  leaveLabel: string;
  /**
   * The tutor steered away before the scene existed. Non-null means the screen
   * must draw it here, because there is no other surface for it to appear on
   * until the first line lands, and it stays until the learner dismisses it.
   */
  banner: RedirectSurface | null;
}

/**
 * What the waiting state shows.
 *
 * A stop is not one of the answers. It never reaches here: both screens return
 * the whole-screen stop surface above every status branch, and the ordering is
 * held by `safetyView.test.ts`.
 */
export function waitingView({ waitingForTutor, safety }: WaitingState): WaitingView {
  return {
    headline: waitingForTutor ? `Waiting for ${TUTOR_NAME}…` : ONE_MOMENT,
    leaveLabel: LEAVE_LABEL,
    banner: safety.kind === 'redirect' ? safety : null,
  };
}
