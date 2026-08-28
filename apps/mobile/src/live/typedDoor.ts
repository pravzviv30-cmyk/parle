/**
 * The typed door, and what taking it costs.
 *
 * The quiet twin used to cost a whole session. Mode was fixed when the grant
 * was minted, so the only way to stop speaking was to rebuild: the screen set
 * its own `textMode`, the connect effect saw the flip and called `start()`
 * again, and the token server was asked for a second session while the first
 * one's thirty-minute lease was still standing. The learner was refused by
 * themselves, at the exact moment the door exists for, which is mid-question on
 * a train when they discover they cannot speak aloud.
 *
 * `switchToText` in the hook is the fix, and this is the rule the screens read
 * so that both of them read the same one. Two decisions, both of which lived in
 * a `.tsx` where apps/mobile has no renderer to ask them a question:
 *
 *   takeTypedDoor   what happens when the learner takes it, and the one case
 *                   where the old rebuild path is still right.
 *   typedDoorFor    whether the failure screen offers it at all.
 *
 * The second one is not decoration. `LiveErrorView` draws the button only when
 * it is handed a handler, so a screen that forgets to pass one renders a
 * sentence saying "you can keep going by typing" above a screen with no way to
 * type. That is the same false promise F197 removed from the copy, wearing a
 * different hat.
 */

import { failureCopy, type LiveFailure } from './failure.ts';

/**
 * What taking the door did.
 *
 * `kept-the-room` is the whole point: the same room, the same scene, the same
 * meter, and no second grant asked for. `needs-a-new-session` is the one case
 * `switchToText` refuses, which is a session that failed before it ever
 * connected. There is no room to go quiet in, so the cold start is not a
 * fallback there, it is the only honest move.
 */
export type TypedDoorOutcome = 'kept-the-room' | 'needs-a-new-session';

/**
 * Take the quiet door, in the room the learner is already standing in.
 *
 * Deliberately takes the session rather than a boolean: the call has to happen,
 * exactly once, and a rule handed the ANSWER instead of the question is a rule
 * that cannot notice a screen that never asked. The hook's `switchToText` is
 * synchronous and never throws, so there is nothing to await and nothing to
 * catch here.
 */
export function takeTypedDoor(session: { switchToText: () => boolean }): TypedDoorOutcome {
  return session.switchToText() ? 'kept-the-room' : 'needs-a-new-session';
}

/**
 * Does this failure screen get a typed door?
 *
 * Two halves. The failure has to be one typing actually answers, which is the
 * taxonomy's business and never a guess made from the rendered sentence. And
 * the learner must not already be typing, because "Continue by typing" offered
 * to somebody with the box already open is a control with nothing to do.
 *
 * A learner who is already typing cannot reach the four failures that carry
 * `canType` anyway: a session with no audio classifies every audio-only vendor
 * fault as silent, and a microphone that was never published cannot be refused.
 * This half is here so the offer stays honest if either of those ever changes.
 */
export function typedDoorFor(failure: LiveFailure, state: { typing: boolean }): boolean {
  return failureCopy(failure).canType && !state.typing;
}
