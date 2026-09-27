/**
 * The words on Profile, kept in a module plain node can load so the copy
 * sweeps read the constants rather than the JSX (F561, F576).
 *
 * It began as the week card's vocabulary and it is the whole tab's now. The
 * file name stayed because `FrenchLifeCard.tsx` stayed: the card became the
 * speaking rhythm and kept its name so every test that reads it by name still
 * reads the thing it was written about.
 *
 * Three of the four lines below are headings, and a heading here is a caps
 * `Label` over a card. There are exactly three of them on the tab now, one per
 * card, because a fourth over a row that reads Settings would say the same
 * word twice.
 *
 * Notebook Phase 4 copy pass (2026-09-27): the tagline under the name ("Your
 * French journey, your way.") became a plain line about what the tab holds,
 * and the caption under the week left with the rail. The week is one sentence
 * now, `rhythmSentence` from `progress/momentum.ts`, and it needs no caption.
 */

/** Under the learner's own name, in the centred header: what this tab holds. */
export const PROFILE_PURPOSE = 'Your tutor, your week and how you like to practise.';

/** Over the card that holds the tutor and what the tutor remembers. */
export const TUTOR_LABEL = 'Your tutor';

/** Over the card that says the week in one sentence. */
export const RHYTHM_LABEL = 'Your speaking rhythm';

/** Over the card of standing choices about how a conversation goes. */
export const LEARNING_LABEL = 'Your learning';

/** Every line the tab spells itself, for the copy sweeps. */
export const FRENCH_LIFE_COPY: readonly string[] = [PROFILE_PURPOSE, TUTOR_LABEL, RHYTHM_LABEL, LEARNING_LABEL];
