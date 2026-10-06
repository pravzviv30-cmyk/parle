/**
 * The new words the first run says (come alive, README Part 5.C rows 1 to 8).
 *
 * Pure, so `copy.test.ts` beside it holds every line to the house rules: warm
 * plain English, no dash and no middot, nothing a streak could nag with
 * (`streakGuiltIn`), and no French praise in the interface (founder decision
 * D14). The literals tests pin in `PreAccountOnboarding.tsx` stay there; these
 * are the lines the new parts in this folder and the reworked pages say.
 */

export const FIRST_RUN_COPY = {
  /** Under the promise title, before the drink tiles. */
  promiseLead: 'First, pick a drink.',
  /** The dashed card that holds the space until a drink is picked. */
  phrasePlaceholder: 'Your first French line appears here.',

  /** The plan card's own name. */
  planLabel: 'Your French plan',
  /** What each question is for, said under its title. All three are true of the code that reads the answer. */
  reasonWhy: 'This picks your first practice.',
  levelWhy: 'This sets how much help you get.',
  goalWhy: 'Last question. You can change it any time.',

  /** The daily goal, one tier at a time (D5). */
  goalTitle: 'What’s your daily goal?',
  chooseEachTime: 'Choose each time',
  /** Said on the one tier the learner's own answers point at, and nowhere else. */
  suggested: 'Suggested from your answers.',

  /** The plan reveal. */
  minutesUnit: 'minutes a day',
  eachDay: 'Each day',
  streakLine: 'Any finished practice counts for your streak, even offline.',
  firstExchange: 'Your first exchange',
  exchangeTileLabel: 'in your first practice',
  sceneTileLabel: 'first scene in your plan',
  tutorTileLabel: 'your AI tutor',

  /** The start sheet's footer. */
  startPractice: 'Start practice',
  connecting: 'Connecting…',
  connected: 'Connected',
  practiseOffline: 'Practise offline',

  /** The practice page. */
  typeInstead: 'Type instead',
  speakInstead: 'Speak instead',
  sendReply: 'Send reply',
  checking: 'Checking your reply…',
  checked: 'Checked',
  stillChecking: 'Still checking. A slow connection can take a few seconds.',
  typedOnly: 'Here you type your reply. You can speak with your tutor in your first conversation.',
  speechPaused: 'Speaking is not available right now. You can type the same reply below.',
  tapToSpeak: 'Tap to speak.',
  listening: 'Listening. Tap to send.',
  hearingYou: 'Hearing you',
  waitingForVoice: 'Waiting for your voice',

  /** The win. */
  youSaid: 'You said',
  naturalWay: 'A natural way to say it',
  exactlyNatural: 'Exactly the natural way.',
  tryItLikeThis: 'Try it like this',
  nextExchange: 'Next exchange',
  continue: 'Continue',
  keepPhrase: 'Keep this phrase',
  keepExample: 'Keep the example',
  phraseKept: 'Phrase kept',
  retry: 'Retry',
  details: 'Details',
} as const;

/** How long the practice page waits on a reply before it says the wait out loud. */
export const SLOW_CHECK_MS = 4000;

/** The seconds a spoken take may run before it is sent, the recorder's own cap. */
export const TAKE_CAP_SECONDS = 20;

/** "8 of 20 seconds": the take's real length against its cap, never a countdown. */
export function takeLength(seconds: number): string {
  const held = Math.max(0, Math.min(TAKE_CAP_SECONDS, Math.floor(seconds)));
  return `${held} of ${TAKE_CAP_SECONDS} seconds`;
}

/** "Exchange 1 of 2": where the learner is in the first practice, counted from the real tasks. */
export function exchangeLabel(index: number, total: number): string {
  return `Exchange ${Math.min(total, index + 1)} of ${total}`;
}

/** Every fixed line above, for the copy checks. */
export const FIRST_RUN_LINES: readonly string[] = [
  ...Object.values(FIRST_RUN_COPY),
  takeLength(0),
  takeLength(12),
];
