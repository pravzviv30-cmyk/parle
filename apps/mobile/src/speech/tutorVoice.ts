/**
 * The demo tutor's voice.
 *
 * expo-speech wraps the platform synthesizer (speechSynthesis in a browser,
 * AVSpeechSynthesizer on iOS). Free and offline — the keyless stand-in for the
 * premium live voice, so the demo is never a silent film. The live path never
 * uses this: its voice comes from the agent over the room.
 */

import * as Speech from 'expo-speech';

import { holdVoice } from '../sound/audioFocus.ts';
import { enterVoicePlayback } from '../sound/audioSession.ts';

/** Slightly under full speed. A beginner is transcribing with their ears. */
const TUTOR_RATE = 0.85;
/**
 * The longest a line may hold the voice focus if the synthesizer never reports its end. A held
 * focus only keeps sound effects quiet, so the cap errs long.
 */
const LONGEST_LINE_MS = 60_000;

let voicePromise: Promise<string | null> | null = null;
let playbackGeneration = 0;
/** The voice focus the line now speaking holds (sound/audioFocus.ts). */
let releaseVoice: (() => void) | null = null;

/** A promise that MUST settle: callers gate the demo's fallback timer on it. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}

async function loadVoices(): Promise<Speech.Voice[]> {
  // On web, expo-speech's voice query resolves only once the browser reports a
  // non-empty voice list — on a machine with no TTS voices installed it never
  // settles at all. Everything downstream falls back to a silent timer, so the
  // one unacceptable outcome is a promise that hangs; bound every wait.
  const first = await withTimeout(Speech.getAvailableVoicesAsync(), 1500, []);
  if (first.length > 0) return first;
  // Browsers populate the voice list asynchronously; one short retry catches
  // the cold-start case where the first call answers before the list exists.
  await new Promise((resolve) => setTimeout(resolve, 300));
  return withTimeout(Speech.getAvailableVoicesAsync(), 1000, []);
}

/** The best French voice this device has, resolved once per launch. */
function frenchVoice(): Promise<string | null> {
  voicePromise ??= loadVoices()
    .then((voices) => {
      const fr = voices.filter((v) => v.language?.toLowerCase().startsWith('fr'));
      const best = fr.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ?? fr[0];
      return best?.identifier ?? null;
    })
    .catch(() => null);
  return voicePromise;
}

/** False when the device has no French voice — callers fall back to a timer. */
export async function available(): Promise<boolean> {
  return (await frenchVoice()) !== null;
}

/** Returns the playback it started, so a chain of lines can tell it was stopped. */
export function speak(text: string, opts?: { onDone?: () => void; rate?: number }): number {
  const generation = ++playbackGeneration;
  void frenchVoice().then(async (voice) => {
    if (generation !== playbackGeneration) return;
    // Cut off anything still playing: a tapped replay must not queue behind the
    // tutor's line and arrive seconds late.
    void Speech.stop();
    releaseVoice?.();
    // The line holds the voice focus until it ends, fails or is stopped, so no
    // sound effect switches the session to one that obeys the silent switch.
    const release = holdVoice();
    const cap = setTimeout(release, LONGEST_LINE_MS);
    const letGo = () => {
      clearTimeout(cap);
      release();
      if (releaseVoice === letGo) releaseVoice = null;
    };
    releaseVoice = letGo;
    // A full voice mode first, after any sound effect has been paused (F723).
    await enterVoicePlayback().catch(() => undefined);
    if (generation !== playbackGeneration) {
      letGo();
      return;
    }
    Speech.speak(text, {
      language: 'fr-FR',
      ...(voice ? { voice } : {}),
      rate: opts?.rate ?? TUTOR_RATE,
      onDone: () => {
        letGo();
        opts?.onDone?.();
      },
      onError: () => {
        letGo();
        opts?.onDone?.();
      },
      onStopped: letGo,
    });
  });
  return generation;
}

/** Speak lines in order, then call done. Used to model the line after the ask. */
export function speakLines(lines: readonly string[], onDone?: () => void): void {
  const [head, ...rest] = lines;
  if (!head) {
    onDone?.();
    return;
  }
  // A stop, or newer speech, ends the chain. A browser reports a cancelled
  // line as an error, which `speak` hands to the same callback as a finished one.
  const generation = speak(head, {
    onDone: () => {
      if (generation === playbackGeneration) speakLines(rest, onDone);
    },
  });
}

export function stop(): void {
  playbackGeneration++;
  void Speech.stop();
}
