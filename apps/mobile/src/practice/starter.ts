/**
 * Practice for a learner with no conversation behind them yet (F554).
 *
 * The three cards are made from the learner's own speech, and a learner on
 * their first evening has none. The page is not left apologising: the same
 * three shapes are drawn from authored material, one sentence says the page
 * becomes personal after the first conversation, and one pill opens it.
 *
 * The material is the café lesson's own: its opening exchange is the first
 * moment, its first line to say is the first phrase, and the sound to tune is
 * the sound check's explanation, because no sound has been measured yet and a
 * sound named without a measurement would be an invention.
 */

import { CAFE_LESSON } from '@luvani/core';

export const STARTER = {
  label: 'Your first conversation',
  line: 'After your first conversation this page is made from what you said: the moment worth replaying, the phrases worth keeping, and one sound to tune.',
  moment: {
    label: 'Your first moment',
    lead: 'The café, where every learner starts.',
    action: 'Walk through it',
  },
  phrase: {
    label: 'A phrase to make yours',
    lead: 'The first line to say out loud.',
  },
} as const;

/** Every line this module can say, for the copy sweeps. */
export const STARTER_COPY: readonly string[] = [
  STARTER.label,
  STARTER.line,
  ...Object.values(STARTER.moment),
  ...Object.values(STARTER.phrase),
];

export interface Starter {
  moment: { tutorFr: string; tutorEn: string; fr: string; en: string };
  phrase: { fr: string; en: string };
}

export function starterFrom(): Starter {
  const turns = CAFE_LESSON.turns;
  // The second exchange is the order itself; the first is only a greeting.
  const moment = turns[1] ?? turns[0]!;
  const phrase = turns[1] ?? turns[0]!;
  return {
    moment: { tutorFr: moment.tutor, tutorEn: moment.tutorEn, fr: moment.target, en: moment.targetEn },
    phrase: { fr: phrase.target, en: phrase.targetEn },
  };
}
