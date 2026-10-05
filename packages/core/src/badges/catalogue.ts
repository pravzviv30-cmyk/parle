/**
 * Milestone badges (founder decision D6): each one names something the
 * learner did, from persisted practice, and is kept once it is awarded so
 * pruned history can never take it back.
 *
 * Titles, lines and hints are plain facts. A line says what happened ("You
 * practised 7 days in a row."); a hint says what earns a badge not yet held
 * ("Reach a 30-day streak"). Nothing here is ever called locked.
 *
 * The art is named, not drawn: the app draws each kind as a flat vector in
 * the current style (decision D10).
 */

import { MONTHLY_QUEST_TARGET } from '../quests/catalogue.ts';

export type BadgeArt = 'flame' | 'pages' | 'bubbles' | 'stamp' | 'stamps' | 'ribbon' | 'arrows' | 'ring' | 'star' | 'wave' | 'chest';

/** The facts a badge reads, each counted from persisted practice. */
export interface BadgeFacts {
  /**
   * The longest streak ever held, which includes the current one. A streak
   * badge is for having done it, so a later reset never matters.
   */
  longestStreak: number;
  lifetimeDays: number;
  /** Conversations ever finished. */
  conversations: number;
  /** Scenes ever earned on your own. */
  scenesOnOwn: number;
  /** Every beginner (A0) scene earned. */
  allA0ScenesEarned: boolean;
  /** Phrase cards kept in the deck, sound cards excluded. */
  phraseCards: number;
  /** Successful recalls in review, all time. */
  recalls: number;
  /** Days the daily goal was met. */
  goalDays: number;
  /** The numbered display level. */
  level: number;
  /** Sound checks ever tried. */
  soundChecks: number;
  /** Quests claimed per calendar month (`YYYY-MM`), the chest excluded. */
  questMonths: readonly { month: string; count: number }[];
}

export interface Badge {
  id: string;
  title: string;
  /** What the learner did, for the moment it is awarded and the shelf. */
  line: string;
  /** What earns it, for "Next up". */
  hint: string;
  art: BadgeArt;
}

export interface BadgeDef extends Badge {
  earned(facts: BadgeFacts): boolean;
}

const atLeast = (value: number, n: number) => Number.isFinite(value) && value >= n;

/** The fixed badges, in the order a shelf lists them. Monthly quest badges follow, one per month. */
export const BADGES: readonly BadgeDef[] = [
  { id: 'streak-7', title: 'One week', line: 'You practised 7 days in a row.', hint: 'Reach a 7-day streak', art: 'flame', earned: (f) => atLeast(f.longestStreak, 7) },
  { id: 'streak-30', title: 'One month', line: 'You practised 30 days in a row.', hint: 'Reach a 30-day streak', art: 'flame', earned: (f) => atLeast(f.longestStreak, 30) },
  { id: 'streak-100', title: '100 days', line: 'You practised 100 days in a row.', hint: 'Reach a 100-day streak', art: 'flame', earned: (f) => atLeast(f.longestStreak, 100) },
  { id: 'streak-365', title: 'One year', line: 'You practised 365 days in a row.', hint: 'Reach a 365-day streak', art: 'flame', earned: (f) => atLeast(f.longestStreak, 365) },
  { id: 'days-50', title: '50 practice days', line: 'You have practised on 50 different days.', hint: 'Practise on 50 different days', art: 'pages', earned: (f) => atLeast(f.lifetimeDays, 50) },
  { id: 'days-200', title: '200 practice days', line: 'You have practised on 200 different days.', hint: 'Practise on 200 different days', art: 'pages', earned: (f) => atLeast(f.lifetimeDays, 200) },
  { id: 'first-conversation', title: 'First conversation', line: 'You finished your first conversation.', hint: 'Finish a conversation', art: 'bubbles', earned: (f) => atLeast(f.conversations, 1) },
  { id: 'scene-own', title: 'On your own', line: 'You finished a scene on your own.', hint: 'Finish a scene on your own', art: 'stamp', earned: (f) => atLeast(f.scenesOnOwn, 1) },
  { id: 'path-a0', title: 'All beginner scenes', line: 'You earned every beginner scene.', hint: 'Earn every beginner scene', art: 'stamps', earned: (f) => f.allA0ScenesEarned === true },
  { id: 'phrases-25', title: '25 phrases kept', line: 'You have kept 25 phrases in your deck.', hint: 'Keep 25 phrases in your deck', art: 'ribbon', earned: (f) => atLeast(f.phraseCards, 25) },
  { id: 'phrases-100', title: '100 phrases kept', line: 'You have kept 100 phrases in your deck.', hint: 'Keep 100 phrases in your deck', art: 'ribbon', earned: (f) => atLeast(f.phraseCards, 100) },
  { id: 'recall-100', title: '100 recalls', line: 'You remembered phrases in review 100 times.', hint: 'Remember phrases in review 100 times', art: 'arrows', earned: (f) => atLeast(f.recalls, 100) },
  { id: 'goal-7', title: 'Goal met 7 times', line: 'You met your daily goal on 7 days.', hint: 'Meet your daily goal on 7 days', art: 'ring', earned: (f) => atLeast(f.goalDays, 7) },
  { id: 'level-10', title: 'Level 10', line: 'You reached Level 10.', hint: 'Reach Level 10', art: 'star', earned: (f) => atLeast(f.level, 10) },
  { id: 'level-25', title: 'Level 25', line: 'You reached Level 25.', hint: 'Reach Level 25', art: 'star', earned: (f) => atLeast(f.level, 25) },
  { id: 'sound-first', title: 'First sound check', line: 'You tried your first sound check.', hint: 'Try a sound check', art: 'wave', earned: (f) => atLeast(f.soundChecks, 1) },
];

/** English month names, fixed rather than read from the device's locale. */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHLY_ID = /^quests-(\d{4}-(?:0[1-9]|1[0-2]))$/;

/** The badge id for a month's quests, or null for a month that does not parse. */
export function monthlyQuestBadgeId(month: string): string | null {
  return MONTH.test(month) ? `quests-${month}` : null;
}

function monthlyBadge(month: string): Badge {
  const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1]!;
  return {
    id: `quests-${month}`,
    title: `${name} quests`,
    line: `You finished ${MONTHLY_QUEST_TARGET} quests in ${name}.`,
    hint: `Finish ${MONTHLY_QUEST_TARGET} quests in one month`,
    art: 'chest',
  };
}

/** The badge behind an id, fixed or monthly, or null for an id no badge has. */
export function badgeFor(id: string): Badge | null {
  const fixed = BADGES.find((b) => b.id === id);
  if (fixed) {
    const { earned: _earned, ...badge } = fixed;
    return badge;
  }
  const monthly = MONTHLY_ID.exec(id);
  return monthly ? monthlyBadge(monthly[1]!) : null;
}
