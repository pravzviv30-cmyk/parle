/**
 * The tutor's side of the recorded first-run exchange: three lines in the
 * default tutor's voice, bundled with the app, so the first two screens play
 * real audio before any account or consent exists. Nothing here may reach an AI
 * service (Apple guideline 5.1.2(i)). `scripts/build-onboarding-audio.mjs`
 * synthesised these once and wrote the asset map in `tutorLineAudio.ts`.
 *
 * The learner's side is not here. It is the daily situation recording
 * `DEMO_REPLY_ID`, which every tutor already voices.
 */

export interface TutorLine {
  readonly id: string;
  readonly fr: string;
  readonly en: string;
}

export const TUTOR_LINES = {
  question: { id: 'onboarding:tutor-question', fr: "Bonjour ! Qu'est-ce que je vous sers ?", en: 'Hello! What can I get you?' },
  followUp: { id: 'onboarding:tutor-follow-up', fr: 'Sur place ou à emporter ?', en: 'For here or to take away?' },
  close: { id: 'onboarding:tutor-close', fr: 'Très bien. Et voilà !', en: 'Very good. There you go!' },
} as const satisfies Record<string, TutorLine>;

/** The recordings exist in this voice only: the first run plays before a tutor is chosen. */
export const TUTOR_LINES_VOICE = 'alexandre';

/** The learner's reply, "Bonjour, je vais prendre un café.", voiced by every tutor. */
export const DEMO_REPLY_ID = 'phrase:situation:cafe-first-coffee:0';
