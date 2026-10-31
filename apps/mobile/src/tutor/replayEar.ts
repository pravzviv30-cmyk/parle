/**
 * The ear on a transcript bubble, decided.
 *
 * Replay has lived on the tutor's last bubble since the control row was cut
 * down to five chips, and nothing on screen said so. The whole affordance was
 * "the bubble happens to be pressable", which is a control only somebody who
 * already knows about it can find. This is the mark that says it is there, and
 * because it has three states across two inputs it is a rule rather than a
 * ternary buried in a `.tsx`.
 *
 * Three states, and the middle one is the point:
 *
 * - `hidden` — nothing to hear. Every learner line, every narration line, every
 *   tutor line that is not the last one, and the last one too whenever the
 *   screen has no replay to offer. An ear on a bubble that cannot be played is
 *   a control that lies about what it does.
 * - `quiet` — there is a line to hear. Drawn in ink, as a mark on a card.
 * - `sounding` — it is playing right now, drawn the way the retired `OptionCard`
 *   drew an auditioning voice: the accent on a `paper.groundDeep` disc. Colour rather
 *   than movement, because there is nothing here for reduce motion to withhold.
 *
 * Why only the last tutor line, restated because it is a product rule rather
 * than an implementation detail: `hear` asks the agent for the current scene
 * line. A bubble five turns up would play a different sentence than the one it
 * sits under.
 */

export type ReplayEar = 'hidden' | 'quiet' | 'sounding';

export interface ReplayEarInput {
  /** This bubble is the most recent tutor line in the thread. */
  isLastTutorLine: boolean;
  /** The screen has a replay to offer: `onReplayTutor` was given. */
  canReplay: boolean;
  /** The tutor is speaking right now. */
  sounding: boolean;
}

export function replayEar({ isLastTutorLine, canReplay, sounding }: ReplayEarInput): ReplayEar {
  // Both halves, and in this order. `sounding` is deliberately not a way in:
  // a tutor talking over a learner's bubble must not put an ear on it, and a
  // screen with no replay to give must not draw one because audio happens to
  // be playing.
  if (!isLastTutorLine || !canReplay) return 'hidden';
  return sounding ? 'sounding' : 'quiet';
}
