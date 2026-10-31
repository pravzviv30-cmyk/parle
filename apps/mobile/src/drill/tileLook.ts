/**
 * The lip tile's look in a choose or build drill (drill B v2, UI-016;
 * drill-b.md "Tile"). Pure, so the four states are tested without a renderer.
 *
 * - `rest`: nothing picked yet, the plain card on its `line` lip;
 * - `picked`: the learner's pick while it is settling or after a miss, the
 *   2pt edge, never a red mark;
 * - `right`: the pick that was right, the mint wash, its pop and one sparkle;
 * - `aside`: every other tile once a pick is in, faded but still readable.
 */

export type TileLook = 'rest' | 'picked' | 'right' | 'aside';

/** What the drill knows about the pick: which tile, and whether it was right. Null before a pick. */
export interface TilePick {
  readonly index: number;
  readonly right: boolean;
}

/** The opacity a set-aside tile keeps: faded, still readable. */
export const ASIDE_OPACITY = 0.45;

export function tileLook(index: number, pick: TilePick | null): TileLook {
  if (pick === null) return 'rest';
  if (index !== pick.index) return 'aside';
  return pick.right ? 'right' : 'picked';
}

/**
 * The choose kinds' pick, from what the drill screen holds while a sheet is
 * up: the attempt it answered with (the option's index, as text) and the
 * verdict. Null when nothing is settling or the attempt is not an index.
 */
export function choosePick(attempt: string | null, verdict: string | null): TilePick | null {
  if (attempt === null || verdict === null) return null;
  const index = Number(attempt);
  if (!Number.isInteger(index) || index < 0 || attempt.trim() === '') return null;
  return { index, right: verdict === 'good' };
}

/** The blank in a fill-blank sentence: a run of two or more underscores. */
const BLANK = /_{2,}/;

/**
 * A fill-blank sentence split around its gap, so the gap can be drawn and a
 * word can land in it. Null when the sentence has no gap, and the sentence
 * is then drawn whole, as before.
 */
export function splitBlank(sentence: string): { before: string; after: string } | null {
  const at = BLANK.exec(sentence);
  if (at === null) return null;
  return { before: sentence.slice(0, at.index), after: sentence.slice(at.index + at[0].length) };
}

/** The one line under a landed word, shown only while a word sits in the gap. */
export const SEND_BACK_LINE = 'Tap the word in the sentence to send it back.';

/** The landed word's accessible name: it is a button that returns the word to the bank. */
export function sendBackLabel(word: string): string {
  return `Send «${word}» back`;
}
