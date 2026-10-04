/**
 * Three one-tap answers, turned into a plan (spine contract section 3). Pure.
 *
 * The plan orders scenes and suggests minutes. It does not place a learner on
 * a level: "I can get by" skips the first coffee and starts the tutor at a
 * low-confidence A1, which `openingRungFor` already reads, and that is all.
 * So the plan screen may claim only what this module can back: the first three
 * scene titles and their can-do lines, the tutor's goal text, the minutes, and
 * the reminder time labelled as not on yet. Never a level name, a date, or a
 * promise of a level; `plan.test.ts` holds every line this module can produce
 * to that.
 *
 * Imports nothing that can reach the network, because the plan is shown before
 * an account exists (`disclosure.test.ts` walks the imports to prove it).
 */

import { starterTasks, type StarterTask, PLANS, SCENE_SPINE, getMission, type MissionId, type MissionPlace } from '@luvani/core';

import { DEFAULT_REMINDER_TIME, reminderTime, type ReminderTimeId } from '../reminders/reminder.ts';
import type { PlanMinutes, PreAccountOnboardingDraft, Reason, StartLevel } from './preAccountDraft.ts';

export interface AnswerOption<K extends string | number> {
  key: K;
  title: string;
  gloss?: string;
}

/** Where are you starting? One tap; zero is the default. */
export const START_LEVELS: readonly (AnswerOption<StartLevel> & { gloss: string })[] = [
  { key: 'zero', title: 'I haven’t started', gloss: '' },
  { key: 'few', title: 'Say hello and order a drink', gloss: '' },
  { key: 'getby', title: 'Have a short conversation', gloss: '' },
];

export const DEFAULT_START_LEVEL: StartLevel = 'zero';

/** What's it for? One tap, and skippable. */
export const REASONS: readonly AnswerOption<Reason>[] = [
  { key: 'food', title: 'Ordering food and drinks' },
  { key: 'trip', title: 'Getting around on a trip' },
  { key: 'family', title: 'Talking with friends or family' },
  { key: 'moving', title: 'Everyday life after a move' },
  { key: 'work', title: 'Simple conversations at work' },
  { key: 'because', title: 'I’m exploring' },
];

/**
 * One fixed line per reason, written as the learner's own goal through
 * `withLearnerGoal` at account creation. The tutor reads it from the session
 * snapshot on the first join, which is after the save page.
 */
export const SEEDED_GOAL: Readonly<Record<Reason, string>> = {
  food: 'Order food and drinks in French.',
  trip: 'Get by in French on my next trip.',
  family: 'Talk with family or a partner in French.',
  moving: 'Handle everyday life in French after a move.',
  work: 'Use French with confidence at work.',
  because: 'Enjoy speaking French, just because.',
};

/** The spine, less the first coffee for a learner who can already get by. */
export function sceneOrder(level: StartLevel): readonly MissionId[] {
  return level === 'getby' ? SCENE_SPINE.filter((id) => id !== 'mission:premier-cafe') : SCENE_SPINE;
}

/** The scene the first run opens on after the account is made. */
export function firstSceneFor(level: StartLevel | null, reason?: Reason | null): MissionId {
  if (reason === 'trip') return 'mission:chemin';
  if (reason === 'family') return 'mission:amis';
  if (reason === 'moving') return 'mission:marche';
  if (reason === 'work') return 'mission:amis';
  return sceneOrder(level ?? DEFAULT_START_LEVEL)[0]!;
}

/** Minutes a day to suggest: work and a move ask for more; otherwise the level decides. */
export function presetMinutes(level: StartLevel, reason: Reason | null): PlanMinutes {
  if (reason === 'work' || reason === 'moving') return 15;
  return level === 'zero' ? 5 : 10;
}

/**
 * The starting level as the brain's estimate: zero and a few words are A0,
 * getting by is A1, always at low confidence, because it is a self-report and
 * the first real evidence replaces it.
 */
export function startEstimate(level: StartLevel): { estimate: 'A0' | 'A1'; confidence: 'low' } {
  return { estimate: level === 'getby' ? 'A1' : 'A0', confidence: 'low' };
}

export function levelOf(draft: PreAccountOnboardingDraft): StartLevel {
  return draft.startLevel ?? DEFAULT_START_LEVEL;
}

export function minutesOf(draft: PreAccountOnboardingDraft): PlanMinutes {
  return draft.minutes ?? presetMinutes(levelOf(draft), draft.reason);
}

export function reminderOf(draft: PreAccountOnboardingDraft): ReminderTimeId {
  return draft.reminderTime ?? DEFAULT_REMINDER_TIME;
}

export interface PlanScene {
  id: MissionId;
  titleEn: string;
  titleFr: string;
  canDoEn: string;
  place: MissionPlace;
}

export interface PlanView {
  starter: StarterTask;
  scenes: readonly PlanScene[];
  minutes: PlanMinutes;
  /** The seeded goal the tutor will be given, or null when the reason was skipped. */
  goal: string | null;
  /** Describes the actual route rule, not an inferred tailored curriculum. */
  startingReason: string;
  reminder: { time: ReminderTimeId; clock: string; note: string };
}

export const PLAN_TITLE = 'Your plan';
export const PLAN_SCENES_LABEL = 'Your first three scenes';
export const MINUTES_LABEL = 'A flexible starting routine';
export const GOAL_LABEL = 'Your goal';
export const GOAL_NOTE = 'This goal chooses your first practice and guides your tutor.';
export const METHOD_LABEL = 'How it works';
export const METHOD_STEPS: readonly string[] = [
  'Talk through a real scene, out loud or by typing.',
  'Get help the moment you stall.',
  'Useful lines come back later as practice.',
];
export const ROUTINE_OPTIONS: readonly AnswerOption<PlanMinutes>[] = [
  { key: 5, title: 'Five minutes' },
  { key: 10, title: 'Ten minutes' },
  { key: 15, title: 'Fifteen minutes' },
  { key: 'none', title: 'No fixed daily target' },
];
export const ROUTINE_NOTE = 'A suggestion for practice, not an extra allowance of live minutes. Change it whenever you like.';
export const COVERAGE_NOTE = 'Beginner scenes. Your starting level is a suggestion, not a certified placement or a full tailored course.';

export function startingReasonFor(level: StartLevel): string {
  if (level === 'getby') return 'Start with a French prompt. Help is available whenever you need it.';
  return level === 'few' ? 'Try your own reply, with translation and help available.' : 'Start with a sentence starter and translation. Help is available.';
}
/**
 * The one line the plan says about days off. It used to deny streaks by naming
 * a missed day and a break, which are the words STYLE section 10 keeps out of
 * practice copy, so it says the kind half only (revamp B, F601).
 */
export const NO_STREAKS = 'A day off takes nothing away.';
/** Beside the plan's hero number: "10 minutes a day". */
export const MINUTES_UNIT = 'minutes a day';
export const REMINDER_LABEL = 'Reminder';
export const REMINDER_NOT_ON = 'Not on yet. You can turn it on later.';
export const SAVE_PLAN = 'Save my plan';

/**
 * The reminder as the plan shows it: the time, said to be off. Nothing is
 * scheduled before an account exists, so the line has to say so.
 */
export function reminderLine(clock: string): string {
  return `Reminder at ${clock}, not on yet.`;
}

/** True, and derived: the trial plan grants its minutes once, for nothing. */
export const TRIAL_LINE = `${PLANS.trial.secondsPerPeriod / 60} free minutes, no card needed`;

/** Every fixed line the plan and save pages can show, for the copy checks. */
export const PLAN_COPY: readonly string[] = [
  PLAN_TITLE,
  PLAN_SCENES_LABEL,
  MINUTES_LABEL,
  ROUTINE_NOTE,
  COVERAGE_NOTE,
  ...ROUTINE_OPTIONS.map(option => option.title),
  MINUTES_UNIT,
  GOAL_LABEL,
  GOAL_NOTE,
  METHOD_LABEL,
  ...METHOD_STEPS,
  NO_STREAKS,
  REMINDER_LABEL,
  REMINDER_NOT_ON,
  SAVE_PLAN,
  TRIAL_LINE,
];

/** The whole plan, from the draft as it stands. */
export function planFor(draft: PreAccountOnboardingDraft): PlanView {
  const first = firstSceneFor(draft.startLevel, draft.reason);
  const scenes = [first, ...sceneOrder(levelOf(draft)).filter(id => id !== first)]
    .slice(0, 3)
    .flatMap((id): PlanScene[] => {
      const mission = getMission(id);
      return mission === undefined
        ? []
        : [{ id, titleEn: mission.titleEn, titleFr: mission.title, canDoEn: mission.canDoEn, place: mission.place }];
    });
  const time = reminderOf(draft);
  return {
    scenes,
    starter: starterTasks(draft.reason, draft.drink ?? 'coffee', minutesOf(draft))[0]!,
    minutes: minutesOf(draft),
    goal: draft.reason === null ? null : SEEDED_GOAL[draft.reason],
    startingReason: startingReasonFor(levelOf(draft)),
    reminder: { time, clock: reminderTime(time).gloss, note: REMINDER_NOT_ON },
  };
}
