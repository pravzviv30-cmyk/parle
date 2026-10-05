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

/** A press: a light impact. */
export function pressed(): void {
  // Native only.
}

/** A hint arriving: the softest impact. */
export function soft(): void {
  // Native only.
}

/** A step in a count: a throttled selection tick. */
export function tick(): void {
  // Native only.
}

/** A weight landing: one medium impact. */
export function thump(): void {
  // Native only.
}

/** A real win: success, then medium, then light. */
export function celebrate(): void {
  // Native only.
}

/** Drop any celebration beats still waiting. */
export function cancelHaptics(): void {
  // Native only.
}
