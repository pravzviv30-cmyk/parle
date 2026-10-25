/**
 * Tap to send and the wrap-up note (2026-10-25): what the room knows about
 * them, read off the message union the way thinking.ts reads "still deciding".
 *
 * The hook cannot be imported under node (useLiveSession.test.ts says why), so
 * the rules live here and the hook only asks.
 */
import type { ClientMessage, HeldTurnState, ServerMessage } from '@luvani/core';

/**
 * Where the learner's held turn stands. The agent says 'open', 'closing' and
 * 'sent'; 'sent' is kept until the tutor takes the floor, so the room does not
 * flick back to "tap Send" in the gap before the answer starts.
 */
export function heldTurnAfter(held: HeldTurnState | null, message: ServerMessage): HeldTurnState | null {
  if (message.t === 'held-turn') return message.state;
  if (message.t === 'speaking' && message.speaking) return null;
  return held;
}

/** Once the tutor says time is nearly up, it stays nearly up for this session. */
export function wrappingUpAfter(wrappingUp: boolean, message: ServerMessage): boolean {
  return wrappingUp || message.t === 'wrap-up';
}

/**
 * The moments the app re-tells the agent about Tap to send: the room opening,
 * a reconnect, and coming back to voice from typing. The agent starts off, so
 * at connect only 'on' is news. After a reconnect or back from typing the
 * state is sent either way: a change to off lost in an outage would leave the
 * agent holding turns while the room hides Send, a minute of waiting a turn.
 */
export type TapToSendMoment = 'connect' | 'reconnect' | 'voice';

export function tapToSendFrames(on: boolean, moment: TapToSendMoment): ClientMessage[] {
  if (moment === 'connect' && !on) return [];
  return [{ t: 'tap-to-send', on }];
}
