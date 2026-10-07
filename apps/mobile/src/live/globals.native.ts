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
 *
 * Two facts, because a recap separates them (F777). `audioStarted`: a live room
 * has started the session and holds it. `sessionUp`: LiveKit's session is
 * active, until `leave()` stops it. A recap gives the room's hold back and the
 * session stays up, so a start that follows without `leave()` is not started
 * yet: it takes the hold again and makes the session active again (the recap's
 * sound may have let the OS deactivate it; activating an active session
 * changes nothing).
 */
let audioStarted = false;
let sessionUp = false;
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
  sessionUp = true;
}

export async function releaseAudioSession(): Promise<void> {
  if (!sessionUp) return;
  sessionUp = false;
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

/**
 * The session has ended and the microphone is closed, but the room stays open
 * for the recap (F763, `live/recapAudio.ts`): give the hold back so the recap
 * may play its moment. LiveKit's audio session stays up until `leave()` runs
 * `releaseAudioSession`, which then finds no hold to release. LiveKit set its
 * own category, so the next voice, recording or sound effect sets a full mode.
 *
 * Only for a room that has finished. A start that comes after the recap
 * without `leave()` finds LiveKit's session still up but no room holding it,
 * and `ensureAudioSession` takes the hold again for it (F777), so a live room
 * is never left unheld.
 */
export function releaseLiveHold(): void {
  if (!releaseLive) return;
  markUnknown();
  releaseLive();
  releaseLive = null;
  audioStarted = false;
}
