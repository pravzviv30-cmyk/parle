/**
 * The new words the first run says (come alive, README Part 5.C rows 1 to 11).
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

  /**
   * Day one (row 9). The run, its words and the title come from game/copy.ts;
   * this is the rule under the week, said without a live minute in it (D3).
   */
  remindLine: 'Any finished practice counts, even offline.',

  /** Save progress (row 10). */
  keepTitle: 'Save your progress.',
  onThisPhone: 'On this phone only',
  keepLine: 'This is saved on this phone only. A free account keeps it safe and works on your other devices.',
  keepLineSignedIn: 'Save this to your account.',
  saveMyProgress: 'Save my progress',
  notNow: 'Not now',

  /** The guest home (row 10, after Not now). */
  setReminder: 'Set a reminder',
  reminderSet: 'Reminder set.',
} as const;

/** A count and its noun, so one is never "1 replies". */
const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * The save card's rows (row 10), each said only when the phone holds it
 * (`guestProgress.ts` `guestInvestment` decides which). The streak's row is the
 * game's (`GAME_COPY.streak.dayOf`).
 */
export const KEEP_ROWS = {
  replies: (n: number): string => `${counted(n, 'French reply', 'French replies')} that ${n === 1 ? 'works' : 'work'}`,
  kept: (n: number): string => `${counted(n, 'phrase', 'phrases')} kept`,
  /** The first practice of the plan and the daily goal, or the practice alone when the goal is chosen each time. */
  plan: (title: string, minutes: number | null): string => (minutes === null ? title : `${title}, ${minutes} minutes a day`),
  tutor: (name: string): string => `Your AI tutor: ${name}`,
  reminder: (gloss: string): string => `Reminder at about ${gloss}`,
} as const;

/**
 * What a screen reader hears for the week strip: the days of this week the
 * phone saw a practice finished, by name. A week without one says so plainly.
 */
export function weekLabel(practised: readonly string[]): string {
  if (practised.length === 0) return 'This week has no practice days yet.';
  const list = practised.length === 1 ? practised[0]! : `${practised.slice(0, -1).join(', ')} and ${practised[practised.length - 1]!}`;
  return `This week you practised on ${list}.`;
}

/**
 * The hand-off's time with the tutor (row 11), from the server's answer and
 * nothing else. `free` is true on the free allowance, false on a plan, and null
 * when only the balance is known. Nothing at all when no time is held: the
 * offer that follows says what a plan adds.
 */
export function tutorTimeLine(seconds: number, free: boolean | null): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return 'You have less than a minute with your AI tutor.';
  if (free === true) return `You have ${counted(minutes, 'free minute', 'free minutes')} with your AI tutor.`;
  if (free === false) return `You have ${counted(minutes, 'minute', 'minutes')} with your AI tutor on your plan.`;
  return `You have ${counted(minutes, 'minute', 'minutes')} with your AI tutor.`;
}

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

/** Every fixed line above, for the copy checks, with each builder filled at its edges. */
export const FIRST_RUN_LINES: readonly string[] = [
  ...Object.values(FIRST_RUN_COPY),
  takeLength(0),
  takeLength(12),
  KEEP_ROWS.replies(1),
  KEEP_ROWS.replies(3),
  KEEP_ROWS.kept(1),
  KEEP_ROWS.kept(2),
  KEEP_ROWS.plan('Order a coffee', 10),
  KEEP_ROWS.plan('Order a coffee', null),
  KEEP_ROWS.tutor('Sam'),
  KEEP_ROWS.reminder('6:00 pm'),
  weekLabel([]),
  weekLabel(['Monday']),
  weekLabel(['Monday', 'Tuesday']),
  weekLabel(['Monday', 'Tuesday', 'Wednesday']),
  ...[30, 59, 60, 61, 1800]
    .flatMap((seconds) => [true, false, null].map((free) => tutorTimeLine(seconds, free)))
    .filter((line): line is string => line !== null),
];
