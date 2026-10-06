/**
 * Web build of the platform shim. Browsers already have WebRTC globals, so there
 * is nothing to do. Metro picks `globals.native.ts` on iOS/Android instead.
 */
import { holdLive } from '../sound/audioFocus.ts';

export function ensureLiveKitGlobals(): void {}

/**
 * Audio session management is a native concern (speaker routing, playAndRecord).
 * On web the browser owns the audio device, so there is no session to start.
 * The room still holds the learner's ears while it is open (sound/audioFocus.ts),
 * as it does on a phone: no sound effect plays and no control gives a haptic
 * during a live room (decision D8). One hold however many times it is started.
 */
let releaseLive: (() => void) | null = null;

export async function ensureAudioSession(): Promise<void> {
  if (releaseLive) return;
  releaseLive = holdLive();
}

export async function releaseAudioSession(): Promise<void> {
  releaseLive?.();
  releaseLive = null;
}
