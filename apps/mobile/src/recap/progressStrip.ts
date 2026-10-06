/**
 * The recap's progress strip, decided apart from drawing it (come alive, core
 * loop 2.9; README Part 5.E "Recap").
 *
 * Under the conversation's headline, three things the finished conversation
 * changed: the XP it credited, the day streak it stands on, and today's goal
 * ring. Every number is the GameDelta's, which `game/settle.ts` read back from
 * disk after the writes landed (the same figures the end cards draw, through
 * `endCardView`), never a number this screen worked out. A part appears only
 * when its number exists, and with no delta (the settle has not landed, or
 * never will) there is no strip at all, rather than a zero nobody stored. Every
 * word is `game/copy.ts`'s.
 */

import { endCardView } from '../celebrate/endCardModel.ts';
import type { GameDelta } from '../game/delta.ts';
import { GAME_COPY } from '../game/copy.ts';

export interface ProgressStripView {
  /** The XP this conversation credited (written with its plus by `xpText`), and its label. */
  readonly xp: { readonly value: number; readonly label: string } | null;
  /** The day streak after this conversation. */
  readonly streak: { readonly value: number; readonly label: string } | null;
  /** Today's goal ring, from where it stood to where it stands. */
  readonly goal: { readonly from: number; readonly to: number; readonly line: string } | null;
  /** Said when the daily XP limit held some of this conversation back. */
  readonly capLine: string | null;
}

export function progressStripView(delta: GameDelta | null): ProgressStripView | null {
  if (delta === null) return null;
  const view = endCardView(delta);
  const tile = view.tiles.find((t) => t.id === 'xp');
  const xp = tile === undefined ? null : { value: tile.value, label: tile.label };
  const current = delta.streak.after.current;
  const streak = Number.isSafeInteger(current) && current > 0 ? { value: current, label: GAME_COPY.streak.label } : null;
  const goal = view.goal;
  if (xp === null && streak === null && goal === null) return null;
  return { xp, streak, goal, capLine: view.capLine };
}
