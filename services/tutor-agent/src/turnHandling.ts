/**
 * How the session decides the learner has finished, and what it does while
 * they are still going.
 *
 * These four settings used to be written inline where the session is built,
 * which is the one place in this service with no test around it. They decide
 * whether a beginner's sentence survives, and whether every turn quietly buys
 * a model call nobody hears, so they are worth more than a comment.
 *
 * Pure: mode and starting rung in, options out, no environment read except the
 * one flag passed to it. The pause floor itself, and how it moves during the
 * session, lives in thinkingTime.ts (VOICE-010).
 */
import type { Rung } from '@luvani/core';
import { endpointingFor, type Endpointing } from './thinkingTime.ts';

/** Which product the room is running. Text variants share their parent's rules. */
export type SessionMode = 'convo' | 'lesson';

export interface TurnHandling {
  interruption: {
    minDuration: number;
    minWords: number;
    discardAudioIfUninterruptible: boolean;
  };
  endpointing: Endpointing;
  preemptiveGeneration: { enabled: boolean };
  turnDetection?: 'vad';
}

/**
 * Defaults here are 500ms and 0 words, which let the tutor's own voice — picked
 * up by a speakerphone microphone — cut the tutor off mid-sentence. Requiring
 * real duration plus recogniser-confirmed words kills those phantom barge-ins.
 */
export const INTERRUPTION_MIN_DURATION_MS = 1_200;
export const INTERRUPTION_MIN_WORDS = 2;

export function turnHandlingFor(
  mode: SessionMode,
  env: { turnDetection?: string; startRung?: Rung } = {},
): TurnHandling {
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
    // The session opens on the starting rung's pause floor; no signed rung is
    // a beginner. agent.ts moves it with the rung, cut-offs and "moment".
    endpointing: endpointingFor({ rung: env.startRung, cutOffs: 0, holding: false }),
    // H2. The framework generates a reply speculatively on every final
    // transcript, up to three times a turn, and it is on by default. A lesson
    // genuinely uses that — it calls generateReply and speaks the result. A
    // conversation never does: the brain writes the reply out of band and the
    // pipeline LLM is explicitly told it is unused, so every one of those
    // completions was billed, discarded, and left contending for the same key
    // as the turn the learner was actually waiting on.
    preemptiveGeneration: { enabled: mode === 'lesson' },
    // Unset, SDK 1.9 builds its own audio turn detector: the local
    // turn-detector-v1-mini through @livekit/local-inference (French threshold
    // 0.285). When it scores a pause as unlikely to be the end, the wait is
    // maxDelay; when the native binding or the job's inference executor is
    // missing, it scores every pause 1.0 and the floor alone decides. VOICE-010
    // is sized to hold in that worst case. 'vad' turns the detector off, for
    // latency A/B work.
    ...(env.turnDetection === 'vad' ? { turnDetection: 'vad' as const } : {}),
  };
}
