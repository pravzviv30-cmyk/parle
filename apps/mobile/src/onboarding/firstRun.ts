/**
 * The first two screens as data, and the words of all six (notebook Phase 5).
 *
 * Screen one plays a real recorded exchange: Alexandre asks, Émilie's
 * recording says the learner's reply, Alexandre follows up. Screen two gives
 * the learner that reply to tap, in Alexandre's own recording, and he closes.
 * Every line here is a bundled recording (`exchangeAudio.ts` maps them), so
 * nothing reaches an AI service before an account exists.
 *
 * Values rather than JSX literals, so the order, the voices and the captions
 * can be tested without a renderer (`firstRun.test.ts`).
 */

import { DAILY_PHRASES, tutorVoice, type TutorVoiceKey } from '@luvani/core';

import { DEMO_REPLY_ID, TUTOR_LINES, TUTOR_LINES_VOICE, type TutorLine } from './tutorLines.ts';

export interface ExchangeLine {
  id: string;
  speaker: 'tutor' | 'learner';
  fr: string;
  en: string;
  /** Whose recording plays. */
  voice: TutorVoiceKey;
  /** Which bundle holds it: the three onboarding lines, or the daily manifest. */
  pack: 'onboarding' | 'daily';
}

const reply = DAILY_PHRASES.find((phrase) => phrase.id === DEMO_REPLY_ID);
// The reply is authored in core and pinned by `tutorLines.test.ts`; this is a
// fallback that keeps the screen honest if it ever moved, not a second copy.
const REPLY = { fr: reply?.fr ?? 'Bonjour, je vais prendre un café.', en: reply?.en ?? 'Hello, I will have a coffee.' };

const tutorLine = (line: TutorLine): ExchangeLine => ({
  id: line.id,
  speaker: 'tutor',
  fr: line.fr,
  en: line.en,
  voice: TUTOR_LINES_VOICE,
  pack: 'onboarding',
});

/** Screen one, in playing order. */
export const HEAR_IT_EXCHANGE: readonly ExchangeLine[] = [
  tutorLine(TUTOR_LINES.question),
  { id: DEMO_REPLY_ID, speaker: 'learner', fr: REPLY.fr, en: REPLY.en, voice: 'emilie', pack: 'daily' },
  tutorLine(TUTOR_LINES.followUp),
];

/** Screen two: the question, the reply the learner taps, and the close. */
export const FIRST_LINE = {
  question: tutorLine(TUTOR_LINES.question),
  reply: { id: DEMO_REPLY_ID, speaker: 'learner', fr: REPLY.fr, en: REPLY.en, voice: TUTOR_LINES_VOICE, pack: 'daily' } as ExchangeLine,
  close: tutorLine(TUTOR_LINES.close),
} as const;

/** What "I'm stuck" hands back: the start of the reply, left open. */
export const STUCK_HINT = 'Bonjour, je vais…';

// ─────────────────────────────────────────────────────────── the page words

export const HEAR_TITLE = 'Hear it first';
export const HEAR_REASSURANCE = 'Try a café exchange, with help when you need it.';
export const LEARNER_LABEL = 'A learner';
export const HEAR_NOTE = `A recorded example with ${tutorVoice(TUTOR_LINES_VOICE).persona.name}. Your microphone is off. You can choose another tutor later.`;
export const HEAR_AGAIN = 'Hear the exchange';
export const TRY_A_LINE = 'Try a line';
export const HAVE_ACCOUNT = 'I have an account';

export const FIRST_LINE_TITLE = 'Your first line';
export const FIRST_LINE_PROMPT = 'Tap to hear the reply. Say it aloud if you like.';
export const STUCK = "I'm stuck";
export const HIGHLIGHT_MEANS = 'A useful line to try. Your voice is not recorded or assessed here.';
export const TAP_TO_CONTINUE = 'You can continue without playing the recording.';
export const CONTINUE = 'Continue';

/** An authored illustration of feedback, never a judgment of the learner. */
export const DEMO_COACHING = {
  title: 'How a phrase becomes practice',
  scope: 'An authored example, not an assessment of your French.',
  attempt: 'Je veux un café.',
  attemptEn: 'I want a coffee.',
  feedback: 'That asks for a coffee. Start with "bonjour" to greet the person before ordering.',
  alternative: FIRST_LINE.reply,
  retry: 'Hear the alternative, then try saying it. Your microphone stays off here.',
  kept: 'After a real conversation, you can keep a useful phrase and return to it in Practice.',
} as const;

export const LEVEL_TITLE = 'Where are you starting?';
export const REASON_TITLE = "What's it for?";
export const REASON_SKIP = 'Skip this';
export const ANSWER_HINT = 'One tap. You can change it later.';
export const CHOSEN = 'Chosen';

export const SAVE_TITLE = 'Save your plan';
export const FIRST_NAME_LABEL = 'First name';
export const FIRST_NAME_PLACEHOLDER = 'e.g. James';
export const FIRST_NAME_HINT = 'So your tutor can greet you. You can leave it empty.';
export const ALREADY_HAVE_ACCOUNT = 'I already have an account';
export const YOUNGER = 'I am younger than that';
/**
 * The save page's one pill. It says the age question and the action in one
 * sentence, joined by a comma, because the tap is both (revamp B, F601).
 */
export const CREATE_ACCOUNT_AGE = 'I am 13 or older, create account';
/** The under-13 page: its title, then the one line under it. */
export const UNDER_AGE_TITLE = 'Luvani is for learners thirteen and up.';
export const UNDER_AGE_BODY = 'Please come back when it is the right time.';
/** The two joined, as the refusal has always read. */
export const UNDER_AGE = `${UNDER_AGE_TITLE} ${UNDER_AGE_BODY}`;

/** Every fixed line the six pages show, for the copy checks. */
export const FIRST_RUN_PAGE_COPY: readonly string[] = [
  DEMO_COACHING.title, DEMO_COACHING.scope, DEMO_COACHING.attemptEn,
  DEMO_COACHING.feedback, DEMO_COACHING.retry, DEMO_COACHING.kept,
  HEAR_TITLE,
  HEAR_REASSURANCE,
  LEARNER_LABEL,
  HEAR_NOTE,
  HEAR_AGAIN,
  TRY_A_LINE,
  HAVE_ACCOUNT,
  FIRST_LINE_TITLE,
  FIRST_LINE_PROMPT,
  STUCK,
  HIGHLIGHT_MEANS,
  TAP_TO_CONTINUE,
  CONTINUE,
  LEVEL_TITLE,
  REASON_TITLE,
  REASON_SKIP,
  ANSWER_HINT,
  CHOSEN,
  SAVE_TITLE,
  FIRST_NAME_LABEL,
  FIRST_NAME_PLACEHOLDER,
  FIRST_NAME_HINT,
  ALREADY_HAVE_ACCOUNT,
  YOUNGER,
  CREATE_ACCOUNT_AGE,
  UNDER_AGE_TITLE,
  UNDER_AGE_BODY,
  UNDER_AGE,
];
