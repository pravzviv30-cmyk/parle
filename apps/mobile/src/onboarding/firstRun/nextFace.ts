/**
 * The first run's Continue, off and on (F758; come alive, icons section 3.4).
 *
 * Off is the sand skeleton with soft ink words and arrow: quieter than any live
 * control on every ground a question page has, so it never reads as a second
 * dark button. On is the one ink pill with white words. Pure, so the faces and
 * their contrast are tested without a renderer; `NextButton.tsx` draws them.
 */

import { paper } from '../../palette.ts';

/** What the button says, and what a screen reader calls it. */
export const NEXT_LABEL = 'Continue';
/** Said to a screen reader while it is off: what turns it on. */
export const NEXT_OFF_HINT = 'Choose an answer first';
/** The off face. */
export const NEXT_OFF = { fill: paper.skeleton, words: paper.inkSoft } as const;
/** The live face. */
export const NEXT_ON = { fill: paper.ink, words: paper.onInk } as const;
