/**
 * Native build of the platform shim.
 *
 * `registerGlobals()` installs the WebRTC primitives (RTCPeerConnection etc.) that
 * `livekit-client` expects to find on the global object. After this one call, the
 * exact same client code runs on iOS, Android and web — which is the entire reason
 * we use livekit-client directly rather than a per-platform SDK surface.
 *
 * NOTE: requires a dev build (`npx expo run:ios` / EAS). Expo Go cannot load the
 * native WebRTC module.
 */
import { registerGlobals, AudioSession } from '@livekit/react-native';

import { holdLive } from '../sound/audioFocus.ts';
import { markUnknown } from '../sound/audioSession.ts';

let done = false;

export function ensureLiveKitGlobals(): void {
  if (done) return;
  registerGlobals();
  done = true;
}

/**
 * The OS audio session: without starting it, iOS keeps the route on the receiver
 * at call volume and remote audio can be inaudible. No ios/ dir exists yet — web
 * is the shipping platform — this is for the first dev build.
 */
let audioStarted = false;
/**
 * The room's hold on the learner's ears (sound/audioFocus.ts): while it is held, no sound effect
 * changes the audio mode and no control gives a haptic (decision D8). Taken before the session
 * starts, so nothing can switch the mode while LiveKit is configuring it.
 */
let releaseLive: (() => void) | null = null;

export async function ensureAudioSession(): Promise<void> {
  if (audioStarted) return;
  const release = holdLive();
  try {
    await AudioSession.startAudioSession();
  } catch (error) {
    release();
    throw error;
  }
  releaseLive?.();
  releaseLive = release;
  audioStarted = true;
}

export async function releaseAudioSession(): Promise<void> {
  if (!audioStarted) return;
  audioStarted = false;
  try {
    await AudioSession.stopAudioSession();
  } finally {
    // LiveKit set its own category, so the next voice, recording or sound effect sets a full mode.
    markUnknown();
    releaseLive?.();
    releaseLive = null;
  }
}
