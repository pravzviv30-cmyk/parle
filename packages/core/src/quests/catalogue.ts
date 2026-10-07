/**
 * Daily quests: three small things a day, each finished by real practice
 * (founder decision D6).
 *
 * Every quest is completed by practice the learner finishes, never by opening
 * the app or by time passing. One quest needs the microphone: today's phrase
 * is finished only by recording a take of at least a second, so it is marked
 * `requiresSpeaking` and offered only when the app says it can record
 * (`canRecord`), day one included. Every other quest has a quiet way through:
 * a conversation or a scene can be typed, a practice set takes typed answers,
 * and the sound check has its self-guided result. So a learner without a
 * microphone is never set a quest they cannot finish.
 *
 * The same rule covers live tutor minutes. A quest that needs them is offered
 * only when the server has said some remain; when the billing answer is
 * unknown it is not offered, because a quest the room might refuse is a
 * promise the app cannot keep.
 *
 * Quest XP (+10 each) is kept by the app as claims outside the activity log,
 * so it never touches the content-difficulty standing. Finishing all three is
 * said in one quiet line and earns nothing more (founder decision D22).
 */

import type { DailyGoalMinutes } from '../goal/goal.ts';

export type QuestId =
  | 'finish-practice'
  | 'phrase-of-day'
  | 'practise-twice'
  | 'review-recall'
  | 'conversation'
  | 'practice-set'
  | 'xp'
  | 'minutes'
  | 'new-phrases'
  | 'scene-on-own'
  | 'sound-check'
  | 'goal';

export type QuestSlot = 'easy' | 'core' | 'stretch';

/**
 * Quests that answer to the same practice. One day never offers two from one
 * family, so three quests are three different things to do.
 */
export type QuestFamily = 'sittings' | 'phrase' | 'deck' | 'live' | 'drill' | 'xp' | 'time' | 'sound';

export interface QuestDef {
  id: QuestId;
  slot: QuestSlot;
  family: QuestFamily;
  /** Exact title. `{tutor}` and `{n}` are filled by `questTitle`. */
  title: string;
  /** Fixed target, or null when it follows the daily goal (the XP quest). */
  target: number | null;
  /** Needs live tutor minutes the server has confirmed. */
  needsLiveMinutes: boolean;
  /**
   * Can only be finished by recording the learner's voice, so it needs a
   * microphone the app can use. Offered only when `canRecord` is true.
   */
  requiresSpeaking: boolean;
}

export const QUEST_XP = 10;
/** Quests in one calendar month that earn that month's badge. */
export const MONTHLY_QUEST_TARGET = 30;

export const QUESTS: readonly QuestDef[] = [
  { id: 'finish-practice', slot: 'easy', family: 'sittings', title: 'Finish a practice', target: 1, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'phrase-of-day', slot: 'easy', family: 'phrase', title: "Say today's phrase", target: 1, needsLiveMinutes: false, requiresSpeaking: true },
  { id: 'practise-twice', slot: 'easy', family: 'sittings', title: 'Practise twice today', target: 2, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'review-recall', slot: 'easy', family: 'deck', title: 'Remember 5 phrases in review', target: 5, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'conversation', slot: 'core', family: 'live', title: 'Finish a conversation with {tutor}', target: 1, needsLiveMinutes: true, requiresSpeaking: false },
  { id: 'practice-set', slot: 'core', family: 'drill', title: 'Finish a short practice set', target: 1, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'xp', slot: 'stretch', family: 'xp', title: 'Earn {n} XP', target: null, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'minutes', slot: 'stretch', family: 'time', title: 'Practise for 5 minutes', target: 5, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'new-phrases', slot: 'stretch', family: 'deck', title: 'Add 3 new phrases to your deck', target: 3, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'scene-on-own', slot: 'stretch', family: 'live', title: 'Finish a scene on your own', target: 1, needsLiveMinutes: true, requiresSpeaking: false },
  { id: 'sound-check', slot: 'stretch', family: 'sound', title: 'Try a sound check', target: 1, needsLiveMinutes: false, requiresSpeaking: false },
  { id: 'goal', slot: 'stretch', family: 'time', title: 'Meet your daily goal', target: 1, needsLiveMinutes: false, requiresSpeaking: false },
];

/** The XP quest's target, by the learner's daily goal. */
export const XP_QUEST_TARGETS: Readonly<Record<DailyGoalMinutes, number>> = { 5: 30, 10: 40, 15: 50, 20: 60 };

/** With no goal chosen, the XP quest asks for the smallest amount. */
const XP_QUEST_DEFAULT = 30;

export function questDef(id: QuestId): QuestDef {
  const def = QUESTS.find((q) => q.id === id);
  if (!def) throw new RangeError(`Unknown quest: "${id}"`);
  return def;
}

export function isQuestId(value: unknown): value is QuestId {
  return QUESTS.some((q) => q.id === value);
}

export function questTarget(id: QuestId, goalTarget: DailyGoalMinutes | null = null): number {
  const def = questDef(id);
  if (def.target !== null) return def.target;
  return goalTarget !== null && goalTarget in XP_QUEST_TARGETS ? XP_QUEST_TARGETS[goalTarget] : XP_QUEST_DEFAULT;
}

/** The title a learner reads, with the tutor's name and the XP target filled in. */
export function questTitle(
  id: QuestId,
  options: { tutorName?: string | null; goalTarget?: DailyGoalMinutes | null } = {},
): string {
  const tutor = options.tutorName?.trim() || 'your tutor';
  return questDef(id)
    .title.replace('{tutor}', tutor)
    .replace('{n}', `${questTarget(id, options.goalTarget ?? null)}`);
}

/** What the app knows when it first picks a day's quests. */
export interface QuestEligibility {
  /** Practice days before the day being picked for. Zero is day one. */
  practiceDaysBefore: number;
  /** Phrase cards in the review deck, sound cards excluded. */
  phraseCards: number;
  /** Conversations ever finished. */
  conversations: number;
  /** Live tutor seconds the server says remain, or null when unknown (offline, unread). */
  liveSecondsRemaining: number | null;
  /**
   * True when the app can record the learner's voice. False when the
   * microphone is denied or unavailable, and when the app cannot tell, for the
   * reason unknown live minutes are refused: a quest that might not be
   * finishable is a promise the app cannot keep.
   */
  canRecord: boolean;
}

/** Whether a quest can be offered today. */
export function questEligible(
  id: QuestId,
  eligibility: QuestEligibility,
  goalTarget: DailyGoalMinutes | null,
): boolean {
  const def = questDef(id);
  if (def.requiresSpeaking && eligibility.canRecord !== true) return false;
  const live = eligibility.liveSecondsRemaining;
  if (def.needsLiveMinutes && !(typeof live === 'number' && live > 0)) return false;
  switch (id) {
    case 'practise-twice':
      return eligibility.practiceDaysBefore >= 1;
    case 'review-recall':
      return eligibility.phraseCards >= 5;
    case 'scene-on-own':
      return eligibility.conversations >= 1;
    case 'goal':
      return goalTarget !== null;
    default:
      return true;
  }
}
