/**
 * The web-safe half of the haptics seam.
 *
 * Metro replaces this with haptics.native.ts on a device. A desktop browser
 * receives the visible pressed state and no attempted vibration: haptics are a
 * courtesy, never the only receipt that a press landed.
 */

/** A tap that landed: a light tick, the weight of a key. */
export function tapSettled(): void {
  // Native only.
}

/** Arriving somewhere earned: the end of a conversation, a drill finished. */
export function arrived(): void {
  // Native only.
}
