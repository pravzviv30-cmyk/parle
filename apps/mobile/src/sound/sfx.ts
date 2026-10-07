/**
 * The node half of the sound-effect seam: the same exports as sfx.native.ts and sfx.web.ts, all
 * silent. Metro picks the platform file on a phone or in a browser (metro.platform.cjs); the test
 * runner loads this one, so a screen that plays a sound still loads under node.
 */
import type { SfxId } from './sfxIds.ts';

/** Plays a sound effect when every rule allows it (sound/sfxCore.ts). Silent here. */
export function play(_id: SfxId): void {
  // Native and web only.
}

/** Creates the players for these sounds ahead of their first use. Silent here. */
export function warmSfx(_ids: readonly SfxId[]): void {
  // Native only.
}

/** Pauses every sound effect that might be playing. Silent here. */
export function pauseAllSfx(): void {
  // Native and web only.
}
