/**
 * The inert seam for a future consented speech dataset (docs/changes/speech-dataset.md).
 *
 * Nothing is stored or sent today. The only sink is `NO_CLIP_SINK`, which does
 * nothing, and a clip is offered at all only when the server flag
 * `LUVANI_SPEECH_DATASET=1` and the learner's consent bit are both on. Nothing
 * sets that consent bit yet: activation is later work, after legal review.
 *
 * A candidate deliberately carries no transcript. The reference line is what
 * the learner was asked to say, and it is the only text that travels with audio.
 */

import type { PhonemeObservation } from '@luvani/core';

/** On only for the exact value '1', like every other Luvani flag. */
export function speechDatasetEnabled(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): boolean {
  return env.LUVANI_SPEECH_DATASET === '1';
}

export interface ClipCandidate {
  /** The known reference line the learner said, and was scored against. */
  reference: string;
  lessonId: string;
  /** The lesson turn's own `id`. */
  turnId: string;
  /** The 16 kHz mono audio the scorer was handed. */
  wav: Uint8Array;
  durationSec: number;
  observations: readonly PhonemeObservation[];
}

export interface ClipSink {
  offer(clip: ClipCandidate): void;
}

/** The only sink that exists: no I/O, no network, no logging of audio. */
export const NO_CLIP_SINK: ClipSink = { offer() {} };

/** Capture needs both the server switch and the learner's own yes. */
export function mayCapture({ enabled, consent }: { enabled: boolean; consent: boolean }): boolean {
  return enabled && consent === true;
}
