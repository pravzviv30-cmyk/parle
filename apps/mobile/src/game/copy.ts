/**
 * Every line the game layer says: the end card, the takeovers, the toast and
 * the one intro sheet. README Part 6 gives this file the streak, goal, quest
 * and badge wording, so the host, the pipeline and the screens all read it
 * from here and no surface grows its own.
 *
 * The rules (founder decisions D2, D4, D6, D14):
 * - Warm, plain English. A number is only ever one that is on disk.
 * - A streak states facts. It never threatens, counts down or pleads, which
 *   game/copy.test.ts holds against BANNED_IN_STREAK_COPY.
 * - The lifetime count of practice days sits beside the run and only rises,
 *   so a reset never shows a learner nothing.
 * - Covered days bridge a run, so nothing here says "in a row" (F741).
 * - Levels are numbers. Rank names are never shown.
 */
import type { SittingSource } from './delta.ts';

export const GAME_COPY = {
  continue: 'Continue',
  seePlans: 'See plans',

  endCard: {
    kicker: 'Practice complete.',
    line: {
      convo: 'You finished a conversation.',
      lesson: 'You finished a lesson.',
      drill: 'You finished a practice set.',
      review: 'You finished your review.',
      phrase: "You practised today's phrase.",
      guest: 'You finished your first practice.',
    } satisfies Record<SittingSource, string>,
    xpLabel: 'XP earned',
    timeLabel: 'Time',
    countLabel: {
      convo: 'Lines you said',
      lesson: 'Words used',
      drill: 'Got right',
      review: 'Remembered',
      phrase: 'Days practised',
      guest: 'Replies that work',
    } satisfies Record<SittingSource, string>,
    capLine: "You reached today's XP limit. This practice still counts for your streak.",
    alsoToday: 'Also today',
  },

  goal: {
    reached: 'Daily goal reached',
    progress: (minutes: number, goal: number): string => `${minutes} of ${goal} min today`,
  },

  quests: {
    /** The day so far. At three it is the one quiet line that says all three are done (D22). */
    progress: (done: number): string => (done >= 3 ? 'All three quests done today.' : `${done} of 3 quests done today`),
    row: (title: string): string => `Quest complete: ${title}`,
  },

  streak: {
    label: 'day streak',
    line: (current: number): string => (current === 1 ? 'Your streak starts today.' : 'You practised today.'),
    restored: 'Your streak is back.',
    /** The same phrasing as progress/dayCount.ts, so the two never disagree. */
    lifetime: (total: number): string => `${total} ${total === 1 ? 'day' : 'days'} you have practised`,
    milestone: (n: number): string => {
      if (n === 7) return 'A whole week of French.';
      if (n === 30) return 'A month of French, one day at a time.';
      if (n === 100) return 'One hundred days of French.';
      if (n === 365) return 'A full year of French.';
      const years = Math.round(n / 365);
      return `${years} years of French.`;
    },
    /** The one calm line a free learner sees after a reset (D4). No countdown, no notification. */
    repairForSubscribers: 'Subscribers can repair a streak within 2 days.',
  },

  level: {
    title: (level: number): string => `Level ${level}`,
    line: 'Earned from the French you produced.',
    next: (toNext: number, nextLevel: number): string => `${toNext} XP to Level ${nextLevel}`,
  },

  badge: {
    row: (title: string): string => `Badge: ${title}`,
  },

  phraseSaved: 'Saved to your phrasebook.',

  intro: {
    title: 'Your streak and level',
    body: (current: number, level: number): string =>
      current > 0
        ? `You are on a ${current}-day streak and at Level ${level}, counted from the practice already saved on your account.`
        : `Your next practice starts a streak. You are at Level ${level}, counted from the practice already saved on your account.`,
  },
} as const;
