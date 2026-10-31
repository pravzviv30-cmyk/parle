/**
 * The words on a finished drill set's end scene. The tiles' own words are
 * the game layer's (`game/copy.ts`); these say what happens to the phrases
 * next, with no number, because the numbers are the tiles'.
 */

import { GAME_COPY } from '../game/copy.ts';

export const DRILL_END = {
  /** The end scene's title on a drill set (drill-b.md, End scene; founder approved 2026-10-31). */
  title: "That's today's set.",
  /** The finish in words, when the settle has no numbers to show. */
  finished: GAME_COPY.endCard.line.drill,
  deck: 'Your review deck takes it from here.',
  /** When some phrases went round twice without settling. */
  comingBack: 'Your review deck takes it from here, and brings back the phrases still settling.',
} as const;
