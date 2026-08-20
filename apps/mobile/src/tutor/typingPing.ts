/**
 * Typing is presence.
 *
 * Measured on a real session: `convo complete, 1 turns, 4 rescues, 105s`. The
 * tutor stepped in roughly every twenty seconds while the founder was typing,
 * because the agent counts silence and a typed learner is silent by definition.
 * Being rescued for thinking is the exact opposite of what the rescue is for.
 *
 * So the app says "still here" on the wire. What it does NOT say is what is
 * being typed: the draft belongs to the learner, and half a sentence is not
 * something to put on a wire. `{ t: 'typing' }` carries no payload at all.
 *
 * A ping per keystroke would be dozens a second on the data channel for one
 * bit of information, so this is the throttle. `now` is a parameter because
 * every rule in this repo takes its clock rather than reaching for one.
 */

/**
 * One ping per about four seconds.
 *
 * Comfortably inside the agent's silence window, so a learner typing steadily
 * never falls through the gap between two pings, and far enough apart that a
 * fast typist is not publishing on every letter.
 */
export const TYPING_PING_MS = 4000;

export function shouldPingTyping(lastPingAt: number | null, now: number): boolean {
  // Nothing sent yet this session: the first keystroke is the most useful ping
  // there is, because it is the one that arrives before the first rescue.
  if (lastPingAt === null) return true;
  // A clock that went backwards (a device settling its time, a suspended tab
  // resuming) must not silence the learner until it catches up.
  if (now < lastPingAt) return true;
  return now - lastPingAt >= TYPING_PING_MS;
}
