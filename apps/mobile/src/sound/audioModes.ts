/**
 * The three audio modes the app ever asks for. Pure: no imports, so the tests read the values.
 *
 * Each mode is FULL. expo-audio fills a missing field from its own defaults, and on iOS the default
 * `playsInSilentMode` is false, which selects `.ambient`: a partial mode such as
 * `{ allowsRecording: false }` quietly made the next voice line follow the silent switch (F723).
 *
 * - VOICE_MODE is today's voice: `.playback` mixing with other apps, audible in silent mode.
 * - RECORD_MODE is the same with the microphone open (`.playAndRecord`, speaker by default).
 * - SFX_MODE is `.ambient`: it mixes with music and obeys the silent switch, so a sound effect is
 *   never louder than the learner asked for.
 */

export type FullAudioMode = {
  readonly playsInSilentMode: boolean;
  readonly interruptionMode: 'mixWithOthers';
  readonly allowsRecording: boolean;
  readonly shouldPlayInBackground: false;
  readonly shouldRouteThroughEarpiece: false;
};

export type AudioModeName = 'voice' | 'record' | 'sfx';

export const VOICE_MODE: FullAudioMode = Object.freeze({
  playsInSilentMode: true,
  interruptionMode: 'mixWithOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
});

export const RECORD_MODE: FullAudioMode = Object.freeze({ ...VOICE_MODE, allowsRecording: true });

export const SFX_MODE: FullAudioMode = Object.freeze({
  playsInSilentMode: false,
  interruptionMode: 'mixWithOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
});

export const AUDIO_MODES: Readonly<Record<AudioModeName, FullAudioMode>> = Object.freeze({
  voice: VOICE_MODE,
  record: RECORD_MODE,
  sfx: SFX_MODE,
});
