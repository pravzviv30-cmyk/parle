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
