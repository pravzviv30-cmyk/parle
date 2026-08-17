/**
 * Web build of the platform shim. Browsers already have WebRTC globals, so there
 * is nothing to do. Metro picks `globals.native.ts` on iOS/Android instead.
 */
export function ensureLiveKitGlobals(): void {}

/**
 * Audio session management is a native concern (speaker routing, playAndRecord).
 * On web the browser owns the audio device; these exist for API parity so the
 * session hook can call them unconditionally.
 */
export async function ensureAudioSession(): Promise<void> {}
export async function releaseAudioSession(): Promise<void> {}
