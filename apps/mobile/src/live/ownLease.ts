/**
 * The token server holds a learner's lease until the last session's agent has
 * finished and debited. Speak in a typed start (F903) tears its own typed room
 * down and asks for a voice grant at once, so the first answers are 409
 * "session already active", and that is the app's own session closing, not
 * another device. Only that rebuild waits; an ordinary start keeps today's
 * answer, because there a 409 really can be another device.
 */

/** About twenty seconds in all, in growing steps. */
export const OWN_LEASE_BACKOFF_MS: readonly number[] = [1000, 2000, 3000, 4000, 5000, 5000];

/** The wait before asking again, or null to stop asking. */
export function ownLeaseRetry(state: { status: number; ownRebuild: boolean; attempt: number }): number | null {
  if (state.status !== 409 || !state.ownRebuild) return null;
  return OWN_LEASE_BACKOFF_MS[state.attempt] ?? null;
}

/** What the screen says when the window runs out. The typed room is closed, so the ways on are again or out. */
export const OWN_LEASE_CLOSING = {
  title: 'Still closing your typed session',
  body: 'Give it a moment, then tap Try again.',
  retry: 'Try again',
  leave: 'Leave',
} as const;
