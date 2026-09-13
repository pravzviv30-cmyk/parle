/**
 * Haptics, as a seam and nothing more (Phase 8 of the upgrade).
 *
 * The brief asks for a small physical answer to two moments: a tap that
 * landed, and arriving somewhere earned. `expo-haptics` is not installed,
 * CocoaPods cannot run on the build machine this repo is developed on, and a
 * native module forces a dev-client rebuild for everyone. So the two calls
 * exist, every surface that wants them calls them, and both are no-ops until
 * the one line below is switched. When it is, the switch is the whole change:
 * no call site moves.
 *
 * Nothing here may throw, block, or read anything. A haptic is a courtesy, and
 * a courtesy that can crash a drill is not one.
 */

/** Flip to true once `expo-haptics` is installed and the dev client rebuilt. */
export const HAPTICS_ENABLED = false;

/** A tap that landed: a light tick, the weight of a key. */
export function tapSettled(): void {
  if (!HAPTICS_ENABLED) return;
}

/** Arriving somewhere earned: the end of a conversation, a drill finished. */
export function arrived(): void {
  if (!HAPTICS_ENABLED) return;
}
