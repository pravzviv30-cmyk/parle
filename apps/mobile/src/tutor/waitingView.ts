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

/** The redirect arm of the surface, named once so the screens can hold it. */
export type RedirectSurface = Extract<SafetySurface, { kind: 'redirect' }>;

/**
 * The one line the wait shows (founder, 2026-11-01): who the learner is waiting
 * for, and nothing else. The connecting page and the first live practice use it too.
 */
export function waitingFor(tutorName: string): string {
  return `Waiting for ${tutorName}`;
}

/** The one door out of the waiting state. */
export const LEAVE_LABEL = 'Leave';

export interface WaitingState {
  /**
   * Who this learner is waiting for, from `tutorPersonaOf`.
   *
   * An argument rather than a constant read in here, because the tutor is
   * whoever the learner chose and two of the eight are women. A module that
   * reached for the default name would put the wrong person on the one line
   * this state shows.
   */
  tutorName: string;
  /** The safety decision as a surface, from `safetySurface`. */
  safety: SafetySurface;
}

export interface WaitingView {
  /** The page's one line. */
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
export function waitingView({ safety, tutorName }: WaitingState): WaitingView {
  return {
    headline: waitingFor(tutorName),
    leaveLabel: LEAVE_LABEL,
    banner: safety.kind === 'redirect' ? safety : null,
  };
}
