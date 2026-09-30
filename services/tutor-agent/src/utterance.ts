/**
 * Capturing what the learner actually said, so it can be scored against what
 * they were meant to say.
 *
 * This is the piece that was missing for the product's second promise. Accuracy
 * scoring needs two things — audio, and a known reference text — and the live
 * path had only ever had the second. `scoreUtterance` was called with the
 * reference and no audio, which returns an empty array every time, so a real
 * session with real keys and a real microphone ended with no pronunciation
 * focus at all. The browser demo faked its observations and looked healthy,
 * which is the worst possible combination.
 *
 * Everything here uses the framework's public surface. `Agent.default.sttNode`
 * is the documented way to sit in front of recognition, so the frames can be
 * observed on their way past without being consumed: the session's own audio
 * input is a single-output multiplexer, and reading it directly would steal
 * frames from the pipeline rather than copy them. `_subscribeAudioStream` would
 * do this too, but the underscore is not decorative.
 *
 * The window is bounded because this holds raw PCM in memory. Thirty seconds is
 * far longer than any scripted turn and small enough not to matter.
 */

import { mergeFrames, stt } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import type { ReadableStream } from 'node:stream/web';
import { encodeWav } from './wav.ts';

export interface CapturedUtterance {
  /** 16-bit PCM WAV — the format the scorer is already handed as `utterance.wav`. */
  wav: Buffer;
  /** How long they spoke for, measured by the recogniser rather than guessed. */
  durationSec: number;
}

/** Longer than any scripted turn, short enough that the buffer is never a problem. */
const WINDOW_SEC = 30;

/**
 * Live audio scoring sits behind a flag, and the flag is off.
 *
 * It began as a guard on the vendor's phone alphabet: an unexpected symbol set
 * fails silently to "no focus" rather than loudly. That alphabet has now been
 * verified against a real TonePerfect response on 2026-09-29, committed as
 * fixtures/toneperfect-fr.json, and every symbol in it maps. The flag stays
 * for a different reason: it is how a deployment switches live scoring off
 * without pulling keys that drills still use. By the founder's decision of
 * 2026-09-29 it stays off until scoring runs off the reply path (F623), because
 * a score awaited before the reply adds three to four seconds of silence.
 */
export function audioScoringEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LUVANI_AUDIO_SCORING === '1';
}

export class UtteranceTap {
  // Counted in samples, not seconds. A frame is 0.1s, 0.1 is not representable
  // in binary, and after twenty frames the accumulated error is enough to pull a
  // neighbouring frame into the slice — which is audible as a click and, worse,
  // means the scorer is graded on a fraction of a sound the learner did not make
  // in that word. Integers have no such opinion.
  #window: { frame: AudioFrame; startSample: number; endSample: number }[] = [];
  #elapsedSamples = 0;
  #sampleRate = 0;
  #speechStartSample: number | null = null;
  #pending: CapturedUtterance | null = null;

  /** Where the stream has got to, in seconds of audio seen. */
  get elapsedSec(): number {
    return this.#sampleRate === 0 ? 0 : this.#elapsedSamples / this.#sampleRate;
  }

  /** Observe one frame on its way to the recogniser. */
  push(frame: AudioFrame): void {
    this.#sampleRate = frame.sampleRate;
    this.#window.push({
      frame,
      startSample: this.#elapsedSamples,
      endSample: this.#elapsedSamples + frame.samplesPerChannel,
    });
    this.#elapsedSamples += frame.samplesPerChannel;

    const window = WINDOW_SEC * frame.sampleRate;
    while (this.#window.length > 0 && this.#elapsedSamples - this.#window[0]!.startSample > window) {
      this.#window.shift();
    }
  }

  /**
   * Cut the utterance out of the window.
   *
   * The recogniser's own start and end times are preferred: they are what the
   * durations on the end card should be measured with, and they exclude the
   * silence either side. They share an origin with this window — both start when
   * the stream does — but a reconnect can shift the recogniser's clock, so an
   * empty slice falls back to "everything since speech started", which is always
   * in this timeline and never wrong by more than the leading silence.
   */
  capture(startSec: number, endSec: number): CapturedUtterance | null {
    if (this.#sampleRate === 0) return null;
    const toSamples = (sec: number) => Math.round(sec * this.#sampleRate);

    let slice = this.#framesBetween(toSamples(startSec), toSamples(endSec));
    let durationSec = endSec - startSec;

    if (slice.length === 0) {
      const from = this.#speechStartSample ?? 0;
      slice = this.#framesBetween(from, this.#elapsedSamples);
      durationSec = (this.#elapsedSamples - from) / this.#sampleRate;
    }
    this.#speechStartSample = null;
    if (slice.length === 0) return null;

    const merged = mergeFrames(slice);
    this.#pending = {
      wav: encodeWav({ sampleRate: merged.sampleRate, channels: merged.channels, samples: merged.data }),
      durationSec: Math.max(0, durationSec),
    };
    return this.#pending;
  }

  /** Take the utterance captured for the turn that just ended, if there was one. */
  take(): CapturedUtterance | null {
    const captured = this.#pending;
    this.#pending = null;
    return captured;
  }

  /** Read one recognition event. Returns what it captured, for tests. */
  observe(event: stt.SpeechEvent | string): CapturedUtterance | null {
    if (typeof event === 'string') return null;

    if (event.type === stt.SpeechEventType.START_OF_SPEECH) {
      this.#speechStartSample = this.#elapsedSamples;
      return null;
    }
    if (event.type !== stt.SpeechEventType.FINAL_TRANSCRIPT) return null;

    const best = event.alternatives?.[0];
    if (!best) return null;
    const { startTime, endTime } = best;
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      const from = (this.#speechStartSample ?? 0) / (this.#sampleRate || 1);
      return this.capture(from, this.elapsedSec);
    }
    return this.capture(startTime, endTime);
  }

  #framesBetween(startSample: number, endSample: number): AudioFrame[] {
    return this.#window.filter((e) => e.endSample > startSample && e.startSample < endSample).map((e) => e.frame);
  }
}

/** Pass frames through to the recogniser, keeping a copy on the way. */
export async function* observeFrames(
  audio: ReadableStream<AudioFrame> | AsyncIterable<AudioFrame>,
  tap: UtteranceTap,
): AsyncGenerator<AudioFrame> {
  for await (const frame of audio as AsyncIterable<AudioFrame>) {
    tap.push(frame);
    yield frame;
  }
}

/** Pass recognition events through, watching for the end of an utterance. */
export async function* observeEvents(
  events: ReadableStream<stt.SpeechEvent | string> | AsyncIterable<stt.SpeechEvent | string>,
  tap: UtteranceTap,
): AsyncGenerator<stt.SpeechEvent | string> {
  for await (const event of events as AsyncIterable<stt.SpeechEvent | string>) {
    tap.observe(event);
    yield event;
  }
}
