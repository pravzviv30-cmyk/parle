/**
 * Whether the voice circle moves, or holds its final frame.
 *
 * There are four reasons for the orb to be still and they were written as two
 * conditions inside a `useEffect`, which is how the fourth came to be missed:
 * a bottom tab stays mounted after its first visit, so one trip to Tutor left
 * two native-driver loops breathing behind every other tab for the rest of the
 * session. `live/thinking.ts` is the same move for the same reason, and
 * `illustrations/useSceneMotion.ts` already answers this question for every
 * drawing in the app; the orb is the one animated thing that was not asking it.
 *
 * Resting is never blanking. Every caller sets the drivers to their resting
 * frame and leaves the colour and the caption exactly where they are, so a
 * paused circle still says which state the tutor is in. That is the rule
 * `useSceneMotion` states as "reduce-motion renders the FINAL FRAME, never
 * nothing", and a paused scene is held to it too.
 */

export interface OrbMotion {
  /** How far the rings travel from rest, as a scale delta. Zero moves nothing. */
  amplitude: number;
  /** Whether the state dims instead of moving. Thinking is the one that does. */
  shimmer: boolean;
  /** The OS setting, watched rather than sampled once. */
  reduced: boolean;
  /** True when the screen holding the orb is not the one on top. */
  paused: boolean;
}

/**
 * True when the orb should sit on its final frame instead of looping.
 *
 * The last clause is the one that is easy to write backwards: no amplitude is
 * not the same as nothing to do, because the thinking state dims rather than
 * travels, and a circle held still while the tutor is deciding reads as an app
 * that has stopped.
 */
export function orbRests({ amplitude, shimmer, reduced, paused }: OrbMotion): boolean {
  return paused || reduced || (amplitude === 0 && !shimmer);
}
