/**
 * How much of the lesson's footer is drawn at a given reading size (F462).
 *
 * `ScrollScreen` puts `header` and `footer` outside the scroll view, and the
 * lesson fills both. At accessibility XXXL the two grow until the scroll view
 * between them has almost no height, and the card carrying the line the learner
 * is being asked to say goes off screen with nothing left to scroll. That is
 * F462, and it is the third defect on the same axis after F383 and F461.
 *
 * The footer cannot simply be moved into the body: the rung row and the speak
 * circle are the controls, and controls that scroll away under a thumb are the
 * defect this frame was built to avoid. What can go is the row of quiet text
 * actions beneath the circle. At a large reading size each of them is a full
 * line of its own, and folding them into one chip gives the body back the
 * height they were taking.
 *
 * Nothing here clips anything. The actions are all still reachable, one tap
 * further away, which is the trade a learner at that reading size is already
 * making everywhere else on their phone. No `numberOfLines`, no capped
 * multiplier, no shrinking type: the chip grows with the text like every other
 * control in this app.
 *
 * It is a plain module rather than a branch inside the component for the reason
 * `live/thinking.ts` gives: apps/mobile has no renderer, so a rule written into
 * a `.tsx` is a rule nothing can ask a question about.
 */

/**
 * Where "large text" begins, as a multiple of the default reading size.
 *
 * Fold the supporting footer actions once the learner selects larger text.
 * The content remains readable rather than competing with the primary action.
 */
export const FOLD_SCALE = 1.5;

/** The word on the chip the row folds into. Sentence case, like every control. */
export const MORE_LABEL = 'More';

/** What a screen reader hears on it: what it does, not what it is called. */
export const MORE_HINT = 'Show the help controls for this line';

/**
 * Does the lesson's row of quiet actions fold into one chip at this size?
 *
 * Total over every scale a platform can report, including the nonsense ones: a
 * font scale is read off the OS and a zero, a negative or a NaN is a broken
 * read rather than a tiny reading size, so anything that is not a real number
 * at or above the fold leaves the row exactly as it has always been drawn.
 */
export function footerFolds(fontScale: number): boolean {
  return Number.isFinite(fontScale) && fontScale >= FOLD_SCALE;
}

/**
 * Is the row of actions on screen right now?
 *
 * One expression rather than two conditions written out at the call site, so
 * the chip and the row can never both be drawn and never both be missing.
 */
export function showsActionRow(fontScale: number, opened: boolean): boolean {
  return !footerFolds(fontScale) || opened;
}

/**
 * Where the turn's note is drawn, or null when there is none to draw.
 *
 * Notebook Phase 4 (2026-09-27). Most lesson notes are about a sound (the nasal
 * in "bonjour", the silent "t" in "croissant"), and at the foot of the scroll
 * body a learner looking at the microphone never met them. So the note sits
 * directly above the mic footer while the learner holds the floor. At the large
 * reading sizes the footer has already folded to give the body room (F462), and
 * a note in it would take that room straight back, so there it stays in the
 * body. A broken font-scale read is not a large reading size, as above.
 */
export function soundNoteIn(fontScale: number, note: string | null | undefined, listening: boolean): 'footer' | 'body' | null {
  if (!listening || note == null || note.trim().length === 0) return null;
  return footerFolds(fontScale) ? 'body' : 'footer';
}
