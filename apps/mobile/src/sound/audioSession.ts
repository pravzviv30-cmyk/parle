/**
 * The audio session, and the only file in the app that imports `setAudioModeAsync` (F723).
 *
 * Every voice player calls `enterVoicePlayback()` before it plays; every recorder calls
 * `enterRecording()` before it records and `leaveRecording()` on every way out; the sound-effect
 * seam calls `enterSfx()`, which refuses while a microphone, voice line or live room holds focus
 * (sound/audioFocus.ts). The rules live in sound/audioSessionCore.ts, where the tests run them.
 *
 * Not imported by any test: expo-audio is a native module (docs/TESTING.md).
 */
import { setAudioModeAsync } from 'expo-audio';

import { createAudioSession } from './audioSessionCore.ts';

const session = createAudioSession({ setMode: (mode) => setAudioModeAsync(mode) });

export const enterVoicePlayback = session.enterVoicePlayback;
export const enterRecording = session.enterRecording;
export const leaveRecording = session.leaveRecording;
export const enterSfx = session.enterSfx;
export const markUnknown = session.markUnknown;
export const currentAudioMode = session.currentMode;
export const setSfxPause = session.setSfxPause;
