/**
 * The words on Profile, kept in a module plain node can load so the copy
 * sweeps read the constants rather than the JSX (F561, F576).
 *
 * It began as the week card's vocabulary and it is the whole tab's now. The
 * file name stayed because `FrenchLifeCard.tsx` stayed: the card became the
 * speaking rhythm and kept its name so every test that reads it by name still
 * reads the thing it was written about.
 *
 * Four of the five lines below are headings, and a heading here is a caps
 * `Label` over a card. There are exactly three of them on the tab now, one per
 * card, because a fourth over a row that reads Settings would say the same
 * word twice.
 */

/** Under the learner's own name, in the centred header. */
export const PROFILE_PURPOSE = 'Your French journey, your way.';

/** Over the card that holds the tutor and what the tutor remembers. */
export const TUTOR_LABEL = 'Your tutor';

/** Over the tinted panel that draws the week. */
export const RHYTHM_LABEL = 'Your speaking rhythm';

/**
 * Under the week. A stance, not a score.
 *
 * The calendar is evidence, never a chain to protect. It keeps what happened
 * and gives the learner permission to return on their own terms.
 */
export const WEEK_CAPTION = 'Every conversation stays. Return when it suits you.';

/** Over the card of standing choices about how a conversation goes. */
export const LEARNING_LABEL = 'Your learning';

/** Every line the tab and its rhythm card spell themselves, for the copy sweeps. */
export const FRENCH_LIFE_COPY: readonly string[] = [
  PROFILE_PURPOSE,
  TUTOR_LABEL,
  RHYTHM_LABEL,
  WEEK_CAPTION,
  LEARNING_LABEL,
];
