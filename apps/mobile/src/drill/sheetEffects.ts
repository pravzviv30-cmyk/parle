/**
 * Where an answer sheet's sound and haptic meet the device, and nowhere else
 * in the drill (README Part 5.A's one table: a good answer `correct` and
 * `arrived()`, a typo `nearly` and `soft()`, a miss nothing).
 *
 * The sheet's model already says what may play (`answerSheet.ts`); this only
 * plays it, once, through the two seams. Both seams refuse while a microphone,
 * a voice line or a live room holds the audio focus (sound/sfxCore.ts and
 * `hapticsEnabled()`), so a sheet that lands under a recorder stays silent and
 * still. Under Node both seams are silent, so this loads in a suite; the
 * players are injectable so a test can hear what was asked for.
 */

import { arrived, soft } from '../motion/haptics.ts';
import { play } from '../sound/sfx.ts';
import type { SfxId } from '../sound/sfxIds.ts';
import type { SheetHaptic } from './answerSheet.ts';

export interface SheetPlayers {
  play(id: SfxId): void;
  haptic(kind: SheetHaptic): void;
}

const DEVICE: SheetPlayers = {
  play,
  haptic: (kind) => (kind === 'arrived' ? arrived() : soft()),
};

/** Play what a sheet (or the own-words card) allows, and nothing it does not. */
export function fireSheet(effects: { readonly sound: SfxId | null; readonly haptic: SheetHaptic | null }, players: SheetPlayers = DEVICE): void {
  if (effects.sound !== null) players.play(effects.sound);
  if (effects.haptic !== null) players.haptic(effects.haptic);
}
