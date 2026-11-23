import type { MainMode } from '../main/appearanceModel.ts';
import type { ArtGround } from './art/index.ts';

/** White crystal on a dark ground, as on the sky; the blue one on paper. */
export function freezeGround(mode: MainMode): ArtGround {
  return mode === 'dark' ? 'blue' : 'paper';
}
