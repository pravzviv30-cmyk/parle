/**
 * The wait before the room is open.
 *
 * This is the longest silence in the product and it was the least furnished.
 * Both live screens rendered a spinner and one static line over a chain of
 * awaits that can legitimately run to twenty five seconds on a cold start:
 * websocket eight, peer connection twelve, the agent joining twelve, the
 * session opening twenty five. A learner watching one unchanging sentence for
 * that long has no way to tell a slow connection from a dead one, and there was
 * no way out of the branch at all, because both screens return it above every
 * control they own.
 *
 * The sibling state one branch below already had both halves fixed. See
 * `tutor/waitingView.ts`: the shape a screen assembles for itself is the shape
 * nothing can ask a question about, so the whole surface is handed back from a
 * module instead. This is the same move for the state before it.
 *
 * It is deliberately NOT part of `waitingView`. That state has no clock and must
 * not grow one: the tutor may be about to speak, and a screen that counts while
 * it waits will eventually be tempted to say something about how long a person
 * is taking. This one is counting the app's own network, which is the app's
 * fault to describe and nobody else's.
 *
 * Two rules hold here. Every stage returns a door, so leaving is never a state
 * the copy has to reach before it is offered. And no stage carries a number, a
 * countdown or a remark: the words say what the app is doing and what the
 * learner may do about it, and nothing about waiting being long.
 */

/** The way out. The same word the waiting state and both scenes use. */
export const LEAVE_LABEL = 'Leave';

/** How often the screen re-reads its own clock. */
export const CONNECTING_TICK_MS = 1000;

export interface ConnectingStage {
  /** How long the wait has lasted before this stage's words are the right ones. */
  readonly atMs: number;
  /** The one line under the spinner. */
  readonly headline: string;
}

/**
 * What the wait says, in order, and when.
 *
 * The opening line is exactly what both screens said before this module
 * existed: at zero seconds nothing has gone wrong and nothing needs explaining.
 * Six seconds is past a healthy warm start and short of the first real
 * deadline. Twelve is the websocket and peer ceilings, the point at which this
 * attempt is more likely to fail than to land, so it is where the copy stops
 * describing and starts offering.
 */
export const CONNECTING_STAGES: readonly ConnectingStage[] = [
  { atMs: 0, headline: 'Reaching the server…' },
  { atMs: 6000, headline: 'Still reaching the server. This can take a moment.' },
  { atMs: 12000, headline: 'Still reaching the server. You can wait, or leave and try again.' },
];

export interface ConnectingView {
  /** The one line under the spinner. */
  headline: string;
  /** The way out, on every stage: nobody is held in here by the copy. */
  leaveLabel: string;
}

/** Which stage a wait this old is in. Clamped, so a bad clock reads as the start. */
function stageAt(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs)) return 0;
  let index = 0;
  for (let i = 0; i < CONNECTING_STAGES.length; i++) {
    if (elapsedMs >= CONNECTING_STAGES[i]!.atMs) index = i;
  }
  return index;
}

/** What the connecting state shows after `elapsedMs` of waiting. */
export function connectingView(elapsedMs: number): ConnectingView {
  return { headline: CONNECTING_STAGES[stageAt(elapsedMs)]!.headline, leaveLabel: LEAVE_LABEL };
}

/**
 * The elapsed reading a screen should keep, given the one it already has.
 *
 * The screen ticks every second; the words change twice. Handing back the
 * previous value while the stage is unchanged means React compares an identical
 * number and does not re-render, so a twenty five second wait costs two renders
 * rather than twenty five. The alternative is a screen that redraws itself once
 * a second to display the same sentence.
 */
export function connectingTick(prevMs: number, elapsedMs: number): number {
  return stageAt(elapsedMs) === stageAt(prevMs) ? prevMs : elapsedMs;
}
