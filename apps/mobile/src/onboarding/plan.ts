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

import { PLANS, SCENE_SPINE, getMission, type MissionId, type MissionPlace } from '@luvani/core';

import { DEFAULT_REMINDER_TIME, reminderTime, type ReminderTimeId } from '../reminders/reminder.ts';
import type { PlanMinutes, PreAccountOnboardingDraft, Reason, StartLevel } from './preAccountDraft.ts';

export interface AnswerOption<K extends string> {
  key: K;
  title: string;
  gloss?: string;
}

/** Where are you starting? One tap; zero is the default. */
export const START_LEVELS: readonly (AnswerOption<StartLevel> & { gloss: string })[] = [
  { key: 'zero', title: 'Starting from zero', gloss: 'No French yet, and that is fine.' },
  { key: 'few', title: 'A few words', gloss: 'Bonjour, merci, and a little more.' },
  { key: 'getby', title: 'I can get by', gloss: 'Simple chats, with some gaps.' },
];

export const DEFAULT_START_LEVEL: StartLevel = 'zero';

/** What's it for? One tap, and skippable. */
export const REASONS: readonly AnswerOption<Reason>[] = [
  { key: 'trip', title: 'A trip' },
  { key: 'family', title: 'Family or a partner' },
  { key: 'moving', title: 'Moving somewhere French' },
  { key: 'work', title: 'Work' },
  { key: 'because', title: 'Just because' },
];

/**
 * One fixed line per reason, written as the learner's own goal through
 * `withLearnerGoal` at account creation. The tutor reads it from the session
 * snapshot on the first join, which is after the save page.
 */
export const SEEDED_GOAL: Readonly<Record<Reason, string>> = {
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
export function firstSceneFor(level: StartLevel | null): MissionId {
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
  scenes: readonly PlanScene[];
  minutes: PlanMinutes;
  /** The seeded goal the tutor will be given, or null when the reason was skipped. */
  goal: string | null;
  reminder: { time: ReminderTimeId; clock: string; note: string };
}

export const PLAN_TITLE = 'Your plan';
export const PLAN_SCENES_LABEL = 'Your first three scenes';
export const MINUTES_LABEL = 'Minutes a day';
export const GOAL_LABEL = 'Your goal';
export const GOAL_NOTE = 'Your tutor keeps this in mind.';
export const METHOD_LABEL = 'How it works';
export const METHOD_STEPS: readonly string[] = [
  'Talk through a real scene, out loud or by typing.',
  'Get help the moment you stall.',
  'Useful lines come back later as practice.',
];
export const NO_STREAKS = 'No streaks: miss a day and nothing breaks.';
export const REMINDER_LABEL = 'Reminder';
export const REMINDER_NOT_ON = 'Not on yet. You can turn it on later.';
export const SAVE_PLAN = 'Save my plan';

/** True, and derived: the trial plan grants its minutes once, for nothing. */
export const TRIAL_LINE = `${PLANS.trial.secondsPerPeriod / 60} free minutes, no card needed`;

/** Every fixed line the plan and save pages can show, for the copy checks. */
export const PLAN_COPY: readonly string[] = [
  PLAN_TITLE,
  PLAN_SCENES_LABEL,
  MINUTES_LABEL,
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

/**
 * The places the plan's scenes happen in, each once, in scene order. The plan
 * draws a watercolour for these and for nothing else; the opener and the full
 * café share one counter, so a fresh plan shows two places for three scenes.
 */
export function planPlaces(view: PlanView): readonly MissionPlace[] {
  return [...new Set(view.scenes.map((scene) => scene.place))];
}

/** The whole plan, from the draft as it stands. */
export function planFor(draft: PreAccountOnboardingDraft): PlanView {
  const scenes = sceneOrder(levelOf(draft))
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
    minutes: minutesOf(draft),
    goal: draft.reason === null ? null : SEEDED_GOAL[draft.reason],
    reminder: { time, clock: reminderTime(time).gloss, note: REMINDER_NOT_ON },
  };
}
