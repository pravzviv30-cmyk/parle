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
    /** With no goal chosen: the measured minutes alone, and no ring. */
    minutesToday: (minutes: number): string => `${minutes} min today`,
  },

  quests: {
    /** The heading over today's three on Home (Phase 4). */
    title: 'Daily quests',
    /** The day so far. At three it is the one quiet line that says all three are done (D22). */
    progress: (done: number): string => (done >= 3 ? 'All three quests done today.' : `${done} of 3 quests done today`),
    row: (title: string): string => `Quest complete: ${title}`,
    /** One quest's own count, or the word for a quest finished. */
    count: (done: number, target: number): string => `${done} of ${target}`,
    done: 'Done',
  },

  /**
   * Home's one line under the hero (Phase 4), said only while a streak is
   * running and today is still open. A fact and an offer, never a warning.
   */
  nudge: {
    waiting: (current: number): string => `Your ${current}-day streak is waiting. A short practice today makes it ${current + 1}.`,
    milestoneEve: (next: number): string => `One practice today reaches your ${next}-day milestone.`,
  },

  /**
   * The Streak screen, Home's hero and Profile's tiles (Phase 4). Every number
   * is one the game view read from disk; a covered day is said as covered and
   * a day without practice as "no practice", never as missed.
   */
  streakScreen: {
    title: 'Your streak',
    unread: 'Your streak could not be read just now.',
    retry: 'Read it again',
    startStreak: 'Start a streak',
    count: (current: number): string => `${current}-day streak`,
    longest: (days: number): string => `Longest streak: ${days} ${days === 1 ? 'day' : 'days'}`,
    todayCounts: 'Today counts. See you tomorrow.',
    reachNext: (next: number): string => `Practise today to reach ${next}.`,
    startsNext: 'Your next practice starts a streak.',
    week: 'This week',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    day: {
      practised: 'practised',
      freeze: 'covered by a freeze',
      repair: 'covered by a repair',
      travel: 'covered by a travel day',
      todayOpen: 'today, not practised yet',
      open: 'no practice',
      ahead: 'still to come',
    },
    freezes: {
      title: 'Streak freezes',
      ready: (held: number): string => `${held} ready`,
      line: 'If a day gets away from you, a freeze covers it by itself. A used freeze comes back a week later.',
      /** `held` is how many the plan holds: one on the free plan, two on a paid one (D23). */
      returns: (date: string, held = 2): string =>
        held === 1 ? `Your freeze is in use. It comes back on ${date}.` : `Both freezes are in use. One comes back on ${date}.`,
    },
    repair: {
      title: (runBefore: number): string => `Bring back your ${runBefore}-day streak`,
      line: 'Finish two practices within two days and it comes back.',
      progress: (done: number, needed: number): string => `${done} of ${needed} practices done`,
    },
    milestones: 'Milestones',
    milestone: (days: number): string => `${days} days`,
    reachedOn: (date: string): string => `Reached ${date}`,
    reached: 'Reached',
    nextMilestone: (days: number): string => `Your next milestone is ${days} days.`,
    // 2026-10-20 UI-008, artboard B-Streak.
    inARow: 'of French, and counting',
    nextHead: 'Next milestone',
    milestoneTitle: (days: number): string => {
      const words: Record<number, string> = { 7: 'a whole week of French', 30: 'a month of French', 100: 'a hundred days of French', 365: 'a whole year of French' };
      return words[days] === undefined ? `${days} days of French` : `${days} days: ${words[days]}`;
    },
    milestoneProgress: (run: number, days: number): string => `${run} of ${days} days`,
    howTitle: 'How a day counts',
    howLine: 'Any finished practice counts. Your longest streak is always kept.',
    card: {
      ready: (held: number): string => `${held} streak ${held === 1 ? 'freeze' : 'freezes'} ready`,
      inUse: (max: number): string => (max <= 1 ? 'Your streak freeze is in use' : 'Both streak freezes are in use'),
      /** The free plan holds one freeze (D23). */
      free: 'Free with every account',
      plan: 'Two come with your plan',
      line: (max: number): string =>
        `If a day gets away from you, ${max <= 1 ? 'your freeze' : 'a freeze'} covers it by itself. There's nothing to switch on. A used freeze comes back a week later.`,
      upsell: 'A second freeze and streak repair',
    },
  },

  /** Progress (Phase 4): the level card, the counts and the badge shelf. */
  progress: {
    xpTotal: (xp: number): string => `${xp} XP`,
    capped: "You reached today's XP limit. Practice still counts for your streak and goal.",
    counts: {
      phrases: 'Phrases kept',
      conversations: 'Conversations',
      minutes: 'Minutes practised',
      days: 'Practice days',
    },
    badges: 'Badges',
    badgesEmpty: 'Badges you earn show here.',
    nextUp: 'Next up',
    earnedOn: (date: string): string => `Earned ${date}`,
    countedFromSaved: 'Counted from practice already saved',
  },

  streak: {
    label: 'day streak',
    line: (current: number): string => (current === 1 ? 'Your streak starts today.' : 'You practised today.'),
    /** The first run's day one, said once the finished practice is on the phone (README Part 5.C row 9). */
    started: 'Your streak has started.',
    /** A row on the first run's save card, and only while the run is alive. */
    dayOf: (current: number): string => `Day ${current} of your streak`,
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
    repairForSubscribers: 'Subscribers get a second freeze and can repair a streak within 2 days.',
  },

  level: {
    /** "XP level 3": the game's level, named so it never reads as a French level (F858, founder decision 22). */
    title: (level: number): string => `XP level ${level}`,
    line: 'Earned from the French you produced.',
    next: (toNext: number, nextLevel: number): string => `${toNext} XP to XP level ${nextLevel}`,
    /** "130 XP": the lifetime total, the same words on Today and Journey. */
    total: (total: number): string => `${total} XP`,
    /** "95 to the next": what is left to the next XP level. */
    toNext: (toNext: number): string => `${toNext} to the next`,
  },

  /** What a screen reader hears for Home's three parts and Profile's tiles (Phase 4). */
  spoken: {
    streak: (current: number, practisedToday: boolean): string =>
      `${current}-day streak, ${practisedToday ? 'practised today' : 'not practised yet today'}. Opens your streak.`,
    noStreak: 'No streak running yet. Opens your streak.',
    goal: (minutes: number | string, goal: number): string => `Daily goal: ${minutes} of ${goal} minutes practised today. Opens your streak.`,
    minutes: (minutes: number | string): string => `${minutes} minutes practised today. Opens your streak.`,
    level: (level: number, total: number, toNext: number): string =>
      `XP level ${level}, ${total} XP, ${toNext} to the next. Opens Progress.`,
  },

  badge: {
    row: (title: string): string => `Badge: ${title}`,
  },

  phraseSaved: 'Saved to your phrasebook.',

  intro: {
    title: 'Your streak and level',
    body: (current: number, level: number): string =>
      current > 0
        ? `You are on a ${current}-day streak and at XP level ${level}, counted from the practice already saved on your account.`
        : `Your next practice starts a streak. You are at XP level ${level}, counted from the practice already saved on your account.`,
  },
} as const;
