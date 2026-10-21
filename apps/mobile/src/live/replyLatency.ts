/**
 * How long the learner waits for the tutor's voice, measured on the phone.
 *
 * The worker can time its own stages, but the number a learner feels is the
 * gap between finishing what they said and hearing the tutor start, and only
 * the device sees both ends of it. The clock starts when the room confirms
 * the learner's turn (the final transcript, which a typed line is echoed as
 * too) and stops when the tutor's audio starts (the `speaking` frame the worker
 * sends as playout begins).
 *
 * It slightly under-reads the true wait, because the recogniser's own delay
 * before the final transcript is not on the device. That part is in the
 * worker's `[luvani:metrics]` line. Content-free: it holds durations only.
 */

/** Keep the most recent turns only; one session is all a reading is about. */
export const REPLY_LATENCY_SAMPLES = 20;

/** A wait longer than this is a stall or a lost frame, not a reply. */
export const REPLY_LATENCY_CEILING_MS = 30_000;

export interface ReplyLatencyClock {
  /** The learner's turn was confirmed. A later confirmation restarts the wait. */
  learnerTurnConfirmed(at: number): void;
  /** The tutor started speaking. Returns the wait if one was running. */
  tutorStartedSpeaking(at: number): number | null;
  /** Forget a running wait. A new session starts with a new clock instead. */
  reset(): void;
  readonly samples: readonly number[];
}

export function createReplyLatencyClock(): ReplyLatencyClock {
  let startedAt: number | null = null;
  const samples: number[] = [];
  return {
    learnerTurnConfirmed(at) { startedAt = at; },
    tutorStartedSpeaking(at) {
      if (startedAt === null) return null;
      const waited = at - startedAt;
      startedAt = null;
      if (!(waited >= 0) || waited > REPLY_LATENCY_CEILING_MS) return null;
      samples.push(Math.round(waited));
      if (samples.length > REPLY_LATENCY_SAMPLES) samples.shift();
      return Math.round(waited);
    },
    reset() { startedAt = null; },
    get samples() { return samples; },
  };
}

/** The middle wait, which one slow turn cannot drag the way a mean is dragged. */
export function medianMs(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}
