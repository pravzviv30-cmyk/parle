/**
 * What a live screen says while the connection is putting itself back together.
 *
 * livekit-client rebuilds a dropped connection on its own, and until now that
 * was rendered as nothing at all: the room went silent, the tutor stopped
 * answering, and the screen carried on looking live. A learner cannot tell the
 * difference between a tutor thinking and a network that has gone away, so they
 * wait, and then they say it again, and then they leave.
 *
 * It is deliberately NOT the notice. The notice is a vendor hiccup on an
 * eight-second timer, and a blip on a train can easily outlive eight seconds:
 * routed through that slot, the one line explaining the silence would vanish
 * while the silence carried on. So the two are separate inputs with one output,
 * and the precedence is stated here rather than in two screens that could
 * disagree.
 *
 * One line at a time, because the point of the calm slot is that it is calm.
 */

/**
 * The line itself. Short, plain, no number, and honest about which side of the
 * conversation went away: the learner has not done anything, and nothing is
 * being taken from them.
 */
export const RECONNECTING = 'The connection dropped for a moment. Getting it back now.';

export interface ConnectionLine {
  /** What to draw, or null for the ordinary case where the slot is empty. */
  text: string | null;
  /**
   * Which of the two it is. The screens do not vary the styling on it today,
   * and it exists so a caller cannot tell them apart by comparing strings.
   */
  kind: 'reconnecting' | 'notice' | 'none';
}

/**
 * The quiet slot, decided.
 *
 * Reconnecting outranks a notice, and the reason is the timer. A vendor hiccup
 * clears itself after eight seconds whether or not anything is on screen, so a
 * notice hidden underneath a reconnect has not been lost, it has expired. A
 * reconnect hidden underneath a notice would be the only explanation for a dead
 * room, taken off the screen by something smaller.
 */
export function connectionLine(state: { reconnecting: boolean; notice: string | null }): ConnectionLine {
  if (state.reconnecting) return { text: RECONNECTING, kind: 'reconnecting' };
  if (state.notice !== null && state.notice !== '') return { text: state.notice, kind: 'notice' };
  return { text: null, kind: 'none' };
}
