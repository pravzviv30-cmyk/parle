/**
 * What the Phrasebook route says, and what its speaker button is called — F575.
 *
 * Two words and one rule, out of the screen and into a file a test can read.
 * The rule is the small one that keeps being got wrong: a round button with a
 * speaker on it is unlabelled to anybody listening to the screen, and a list of
 * them all saying "Hear" is a list of identical buttons. So the resting label
 * carries the line it will say, and the one that is sounding says Stop, which
 * is the only thing pressing it now does.
 *
 * Nothing here counts. The screen shows a learner every line that has become
 * theirs; how many there are is not a score, and a total printed over a list
 * the learner can see is a number asking to be compared with last month's.
 */

import type { Cadence } from '../myfrench/cadence.ts';

/** The route's own name, set large at the top. */
export const PHRASEBOOK_TITLE = 'Your phrases';

/** What the sounding button offers, which is the only thing it can do. */
export const STOP_LABEL = 'Stop';

/**
 * What a screen reader hears on one phrase's speaker.
 *
 * The French rides in the label rather than being left to the row beside it,
 * because a button reaches assistive tech on its own and "Hear" nine times is
 * nine buttons nobody can tell apart.
 */
export function speakerLabel(french: string, playing: boolean): string {
  return playing ? STOP_LABEL : `Hear ${french}`;
}

/**
 * The authored connectors, as an optional collection (Stage 3).
 *
 * They used to close the page as a long open glossary, so a page of the
 * learner's own French ended on a longer page of somebody else's. Now they
 * sit behind one quiet row, closed until asked for. The set itself, and
 * which of its words are the learner's, is still `myfrench/cadence.ts`'s.
 */
export const CADENCE_SHOW = 'Show words that buy you a moment';
export const CADENCE_HIDE = 'Hide words that buy you a moment';
/** Under the closed row, so a learner knows what opening it gives them. */
export const CADENCE_NOTE = 'A short set of French connectors to hear and borrow.';

/** What the row offers, which is the opposite of the state it is in. */
export function cadenceToggleLabel(open: boolean): string {
  return open ? CADENCE_HIDE : CADENCE_SHOW;
}

/** A row only when the set has words: a door onto nothing is not drawn. */
export function hasCadence(cadence: Cadence | null): cadence is Cadence {
  return cadence !== null && cadence.words.length > 0;
}

/** Every line this route says for itself, for the copy scans. */
export const PHRASEBOOK_COPY: readonly string[] = [PHRASEBOOK_TITLE, STOP_LABEL, CADENCE_SHOW, CADENCE_HIDE, CADENCE_NOTE];
