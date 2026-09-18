/**
 * What the Practice tab says about itself — F574.
 *
 * The tab used to open on the word "Practice" and a four word purpose, which
 * told a learner where they were and nothing about what the page was for. The
 * mockup replaced both with a sentence that answers the only question somebody
 * arriving here actually has: where did this come from, and what is it for.
 *
 * It lives here rather than in `PracticeTab.tsx` for the reason every string in
 * this app does: a screen holds layout, and a line nothing can import is a line
 * nothing can check. The copy sweeps read `PRACTICE_COPY`, so a sixth string
 * added below joins them by existing rather than by being remembered.
 *
 * The two action words are here and not in `nextStep.ts` because they are what
 * the control on the card says, not part of the rule that decides which control
 * it is. `nextStep.ts` reads the label from here so the headline over the card
 * and the card cannot drift apart.
 */

/** The tab's own title, which says where the page came from. */
export const PRACTICE_TITLE = 'Made from your conversations';

/** The line under it: what fills this page, and what fills it. */
export const PRACTICE_PURPOSE =
  'Short practice, shaped from the French you actually used.';

/** The caps label over the one card at the top of the tab. */
export const NEXT_PRACTICE_LABEL = 'Your next practice';

/** The control on a card whose phrase came from the deck. */
export const REVIEW_ACTION = 'Review';

/**
 * The control on a card whose phrase came from a conversation.
 *
 * "Practise" with an s: British spelling, and a verb here.
 */
export const PACK_ACTION = 'Practise this conversation';

/** The provenance line above the three personal practice rows. */
export const MADE_FROM_LABEL = 'Made from your last conversation';

/** A quiet route to the complete conversation library after the recommended work. */
export const CONVERSATION_ARCHIVE_ACTION = 'See your conversations';

/** Every line this module can say, for the copy sweeps. */
export const PRACTICE_COPY: readonly string[] = [
  PRACTICE_TITLE,
  PRACTICE_PURPOSE,
  NEXT_PRACTICE_LABEL,
  REVIEW_ACTION,
  PACK_ACTION,
  MADE_FROM_LABEL,
  CONVERSATION_ARCHIVE_ACTION,
];
