/**
 * Synthetic drill and practice states for the screen preview (drill-b T1).
 *
 * Plain data only: exercises in core's own shapes, the sheet inputs core's
 * verdicts would produce, an own-words outcome, a settled delta for the end
 * card, a sound drill and a line to fix. Nothing here is read by the app
 * outside `dev/`, and nothing here is graded, saved or sent.
 */
import type {
  AppropriateReplyExercise,
  BestSentenceExercise,
  ConvoPhrase,
  Drill,
  FillBlankExercise,
  ListenTypeExercise,
  OwnWordsExercise,
  RepeatThisExercise,
  StreakState,
  TapTranslateExercise,
  TranslationExercise,
  DayKey,
} from '@luvani/core';
import type { SheetInput } from '../drill/answerSheet.ts';
import type { OwnWordsOutcome } from '../drill/kinds/OwnWordsView.tsx';
import type { GameDelta } from '../game/delta.ts';
import type { ClosureRepair } from '../conversationPacks/closure.ts';

const base = (id: string) => ({ id: `preview:${id}`, phraseKey: `preview:${id}` });

export const BEST_SENTENCE: BestSentenceExercise = {
  ...base('best'), difficulty: 'recognition', kind: 'best-sentence',
  prompt: 'You want the bill at the end of the meal.',
  candidates: [
    { fr: 'L’addition, s’il vous plaît.', en: 'The bill, please.' },
    { fr: 'La carte, s’il vous plaît.', en: 'The menu, please.' },
    { fr: 'Une table pour deux.', en: 'A table for two.' },
  ],
  correctIndex: 0,
};

export const APPROPRIATE_REPLY: AppropriateReplyExercise = {
  ...base('reply'), difficulty: 'recognition', kind: 'appropriate-reply',
  line: { speaker: 'Le serveur', fr: 'Qu’est-ce que je vous sers ?', en: 'What can I get you?' },
  options: [
    { fr: 'Je voudrais un café.', en: 'I would like a coffee.' },
    { fr: 'Je vous dois combien ?', en: 'How much do I owe you?' },
    { fr: 'Bonne journée !', en: 'Have a good day!' },
  ],
  acceptableIndexes: [0],
};

export const FILL_BLANK_CHOICE: FillBlankExercise = {
  ...base('blank'), difficulty: 'recognition', kind: 'fill-blank',
  sentence: 'Je ____ un café.', options: ['voudrais', 'vais', 'suis', 'fais'], accepted: ['voudrais'], en: 'I would like a coffee.',
};

export const FILL_BLANK_TYPED: FillBlankExercise = {
  ...base('blank-typed'), difficulty: 'production', kind: 'fill-blank',
  sentence: 'Je vous dois ____ ?', options: null, accepted: ['combien'], en: 'How much do I owe you?',
};

export const TAP_TRANSLATE: TapTranslateExercise = {
  ...base('build'), difficulty: 'production', kind: 'tap-translate',
  en: 'The bill, please.',
  tokens: ['L’addition', 's’il', 'vous', 'plaît', 'la', 'carte'],
  accepted: ['L’addition s’il vous plaît'],
};

/** The words placed so far in a build mid-way, as indexes into its tokens. */
export const TAP_PLACED: number[] = [0, 1];
/** Every word of the right answer, placed. */
export const TAP_ALL: number[] = [0, 1, 2, 3];

export const TRANSLATE_INTO_FR: TranslationExercise = {
  ...base('translate'), difficulty: 'production', kind: 'translate',
  fr: 'Je vous dois combien ?', en: 'How much do I owe you?', direction: 'en-fr', accepted: ['Je vous dois combien ?'],
};

export const TRANSLATE_INTO_EN: TranslationExercise = {
  ...base('translate-en'), difficulty: 'recognition', kind: 'translate',
  fr: 'L’addition, s’il vous plaît.', en: 'The bill, please.', direction: 'fr-en', accepted: ['The bill, please.'],
};

export const LISTEN_TYPE: ListenTypeExercise = {
  ...base('listen'), difficulty: 'production', kind: 'listen-type',
  fr: 'Je voudrais un café.', accepted: ['Je voudrais un café.'],
};

export const REPEAT_THIS: RepeatThisExercise = {
  ...base('say'), difficulty: 'production', kind: 'repeat-this',
  reference: 'Je voudrais un café.', referenceEn: 'I would like a coffee.', ipa: 'ʒə vu.dʁɛ œ̃ ka.fe',
  noMicTwin: LISTEN_TYPE,
};

export const OWN_WORDS: OwnWordsExercise = {
  ...base('own'), difficulty: 'production', kind: 'own-words',
  fr: 'Je vous dois combien ?', en: 'Ask how much you owe', situation: 'You are at the counter, ready to pay.',
  mustKeep: ['combien'], accepted: [],
};

/** A sheet input with the facts DrillScreen pairs with core's feedback. */
function sheet(input: Partial<SheetInput> & Pick<SheetInput, 'verdict' | 'kind'>): SheetInput {
  return { closest: null, advanced: true, combo: 1, turn: 0, screenReader: false, reason: null, oneOfMany: false, answerEnglish: false, ...input };
}

export const SHEETS = {
  chooseRight: sheet({ verdict: 'good', kind: 'best-sentence' }),
  roll: sheet({ verdict: 'good', kind: 'appropriate-reply', combo: 3, turn: 3 }),
  replyMiss: sheet({ verdict: 'miss', kind: 'appropriate-reply', closest: 'Je voudrais un café.', advanced: false, reason: 'je voudrais = I would like' }),
  blankLanded: sheet({ verdict: 'good', kind: 'fill-blank' }),
  blankNearly: sheet({ verdict: 'typo', kind: 'fill-blank', closest: 'combien' }),
  buildRight: sheet({ verdict: 'good', kind: 'tap-translate', turn: 1 }),
  listenMiss2: sheet({ verdict: 'miss', kind: 'listen-type', closest: 'Je voudrais un café.', advanced: true, reason: 'je voudrais = I would like' }),
  intoEnRight: sheet({ verdict: 'good', kind: 'translate', turn: 2 }),
  sayResult: sheet({ verdict: 'good', kind: 'repeat-this' }),
} as const;

/** The scorer's one calm line, as a measured take would give it. */
export const SAY_NOTE = 'The “u” in “voudrais” is rounded, lips forward.';

/** What an own-words attempt came back with, by how core decided it. */
export const OWN_OUTCOMES: Record<'works' | 'nearly' | 'oneway', OwnWordsOutcome> = {
  works: {
    exercise: OWN_WORDS, verdict: 'good', decided: 'good', message: 'That works.', note: null,
    another: 'Je vous dois combien ?', reveal: null, keep: true, attempt: 'C’est combien ?',
  },
  nearly: {
    exercise: OWN_WORDS, verdict: null, decided: 'retry', message: 'Nearly there.',
    note: 'Ask about what you owe, not what it costs.', another: null, reveal: null, keep: false, attempt: 'Combien ça coûte ?',
  },
  oneway: {
    exercise: OWN_WORDS, verdict: 'miss', decided: 'reveal', message: 'Here’s one way to say it.', note: null,
    another: null, reveal: 'Je vous dois combien ?', keep: false, attempt: 'Je paie ?',
  },
};

export const OWN_TYPED = 'C’est combien ?';

const DAY = '2026-10-31' as DayKey;
const streak = (current: number, today: StreakState['today']): StreakState => ({
  current, today, runStart: '2026-10-29' as DayKey, longest: 5, lifetimeDays: 9, lastPracticeDay: today === 'practised' ? DAY : ('2026-10-30' as DayKey), gap: [], coveredInRun: [],
});

/** A settled drill set: 24 XP, four minutes, the day's streak kept. */
export const END_DELTA: GameDelta = {
  key: `sitting:drill:${Date.parse('2026-10-31T09:00:00Z')}`,
  source: 'drill',
  at: Date.parse('2026-10-31T09:00:00Z'),
  activeMs: 4 * 60 * 1000,
  xp: { earned: 24, counted: 24, capped: false, bonus: 0, questXp: 0, totalBefore: 116, totalAfter: 140 },
  goal: { target: 10, minutesBefore: 4, minutesAfter: 8, metNow: false },
  streak: { before: streak(2, 'open'), after: streak(3, 'practised'), extendedNow: true, milestone: null, restoredBy: null },
  quests: { completedNow: [], done: 1, doneBefore: 1 },
  level: { before: 2, after: 2 },
  badges: [],
};

/** The same delta for a review sitting. */
export const REVIEW_END_DELTA: GameDelta = { ...END_DELTA, key: END_DELTA.key.replace('drill', 'review'), source: 'review' };

/** First-try answers on the drill end, and recalled cards on the review end. */
export const END_COUNT = 5;
export const REVIEW_END_COUNT = 3;

/** A sound drill with minimal pairs, in the player's shape. */
export const SOUND_DRILL: Drill = {
  id: 'preview:sound-u', kind: 'minimal-pair', target: 'y', contrast: 'u',
  title: 'The French “u”',
  why: 'It tells “dessus” (on top) from “dessous” (underneath).',
  pairs: [
    { a: { word: 'tu', ipa: 'ty', gloss: 'you' }, b: { word: 'tout', ipa: 'tu', gloss: 'all' } },
    { a: { word: 'rue', ipa: 'ʁy', gloss: 'street' }, b: { word: 'roue', ipa: 'ʁu', gloss: 'wheel' } },
  ],
  durationSec: 60,
};

/** The situation Sound Check reads its known lines from. */
export const SOUND_CHECK_MISSION = 'mission:cafe';

/** A line from a conversation that has a better way to say it. */
export const FIX_REPAIR: ClosureRepair = {
  quote: 'Je veux un café.',
  better: 'Je voudrais un café.',
  betterEn: 'I would like a coffee.',
  why: 'Softer and more polite when you order.',
};

/** Phrases a preview review deck is seeded with, under its own preview scope. */
export const REVIEW_PHRASES: ConvoPhrase[] = [
  { fr: 'L’addition, s’il vous plaît.', frWritten: null, en: 'The bill, please.', enLiteral: null, register: 'polite', note: null },
  { fr: 'Je voudrais un café.', frWritten: null, en: 'I would like a coffee.', enLiteral: null, register: 'polite', note: null },
  { fr: 'Je vous dois combien ?', frWritten: null, en: 'How much do I owe you?', enLiteral: null, register: 'polite', note: null },
];
