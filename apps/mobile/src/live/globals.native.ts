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

export async function ensureAudioSession(): Promise<void> {
  if (audioStarted) return;
  await AudioSession.startAudioSession();
  audioStarted = true;
}

export async function releaseAudioSession(): Promise<void> {
  if (!audioStarted) return;
  audioStarted = false;
  await AudioSession.stopAudioSession();
}
