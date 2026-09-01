/**
 * How the session decides the learner has finished, and what it does while
 * they are still going.
 *
 * These four settings used to be written inline where the session is built,
 * which is the one place in this service with no test around it. They decide
 * whether a beginner's sentence survives, and whether every turn quietly buys
 * a model call nobody hears, so they are worth more than a comment.
 *
 * Pure: mode in, options out, no environment read except the one flag passed
 * to it.
 */

/** Which product the room is running. Text variants share their parent's rules. */
export type SessionMode = 'convo' | 'lesson';

export interface TurnHandling {
  interruption: {
    minDuration: number;
    minWords: number;
    discardAudioIfUninterruptible: boolean;
  };
  endpointing: { minDelay: number };
  preemptiveGeneration: { enabled: boolean };
  turnDetection?: 'vad';
}

/**
 * The framework floor is 500ms, or 300ms with a streaming detector. 400ms is
 * the chosen middle ground between a snappy reply and clipping a slow finish.
 * It is additive on top of the recogniser's own end-of-speech signal, so read
 * `[luvani:metrics] eou` before moving it.
 */
export const ENDPOINTING_MIN_DELAY_MS = 400;

/**
 * Defaults here are 500ms and 0 words, which let the tutor's own voice — picked
 * up by a speakerphone microphone — cut the tutor off mid-sentence. Requiring
 * real duration plus recogniser-confirmed words kills those phantom barge-ins.
 */
export const INTERRUPTION_MIN_DURATION_MS = 1_200;
export const INTERRUPTION_MIN_WORDS = 2;

export function turnHandlingFor(mode: SessionMode, env: { turnDetection?: string } = {}): TurnHandling {
  return {
    interruption: {
      minDuration: INTERRUPTION_MIN_DURATION_MS,
      minWords: INTERRUPTION_MIN_WORDS,
      // H3. Modelled lines are uninterruptible at rung 2 and below, which is
      // every A0 and A1 learner, and the framework default deletes anything
      // said across one. So the learner likeliest to speak at the wrong moment
      // was the one whose sentence disappeared, with nothing to tell them why.
      // The line stays uninterruptible — a speakerphone hears the tutor, and a
      // barge-in during a modelled line is almost never the learner — but their
      // words are now buffered and arrive when the tutor stops.
      discardAudioIfUninterruptible: false,
    },
    endpointing: { minDelay: ENDPOINTING_MIN_DELAY_MS },
    // H2. The framework generates a reply speculatively on every final
    // transcript, up to three times a turn, and it is on by default. A lesson
    // genuinely uses that — it calls generateReply and speaks the result. A
    // conversation never does: the brain writes the reply out of band and the
    // pipeline LLM is explicitly told it is unused, so every one of those
    // completions was billed, discarded, and left contending for the same key
    // as the turn the learner was actually waiting on.
    preemptiveGeneration: { enabled: mode === 'lesson' },
    // No turn-detector plugin is installed, so the framework already falls
    // through to plain silence-based VAD and this flag selects what is
    // happening anyway. It stays as the seam: adding the plugin is the change
    // that would make it mean something, and latency A/B work wants the knob.
    ...(env.turnDetection === 'vad' ? { turnDetection: 'vad' as const } : {}),
  };
}
