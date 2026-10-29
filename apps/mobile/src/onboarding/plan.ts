/**
 * Five direct answers, turned into a plan (spine contract section 3). Pure.
 *
 * The plan orders scenes and suggests minutes. A self-reported starting point
 * sets a placement (`placement.ts`, F917): "I can get by" starts at Basics,
 * "Feeling confident" and "Skip ahead" at Everyday. A placement drops the
 * scenes below it from the suggested order and seeds a low-confidence
 * estimate; it never earns a scene or credits an ability.
 * So the plan screen may claim only what this module can back: the first three
 * scene titles and their can-do lines, the tutor's goal text, the minutes, and
 * the reminder time labelled as not on yet. Never a level name, a date, or a
 * promise of a level; `plan.test.ts` holds every line this module can produce
 * to that.
 *
 * Imports nothing that can reach the network, because the plan is shown before
 * an account exists (`disclosure.test.ts` walks the imports to prove it).
 */

import { starterTasks, type StarterTask, SCENE_SPINE, getMission, GOAL_SCENES, GUEST_CAFE_SCENE, type MissionId, type MissionPlace } from '@luvani/core';

import { DEFAULT_REMINDER_TIME, reminderTime, type ReminderTimeId } from '../reminders/reminder.ts';
import type { PlanMinutes, PracticeFocus, PreAccountOnboardingDraft, Reason, SpeakingConfidence, StartLevel } from './preAccountDraft.ts';
import { starterMinutes } from './guestProgress.ts';
import { PLACEMENT_CEFR, canSkipAhead, placementFor, placementStage, type Placement } from './placement.ts';

export interface AnswerOption<K extends string | number> {
  key: K;
  title: string;
  gloss?: string;
}

/**
 * Four self-reported starting points. These choose support, never a certified
 * placement. Existing saved level keys keep their meaning.
 */
export const START_LEVELS: readonly (AnswerOption<StartLevel> & { gloss: string })[] = [
  { key: 'zero', title: 'Brand new', gloss: 'Let’s begin with bonjour' },
  { key: 'few', title: 'A few words', gloss: 'I know some useful basics' },
  { key: 'getby', title: 'I can get by', gloss: 'Short conversations feel possible' },
  { key: 'confident', title: 'Feeling confident', gloss: 'I want more natural French' },
];

export const CONFIDENCE_OPTIONS: readonly AnswerOption<SpeakingConfidence>[] = [
  { key: 'hesitant', title: 'A little daunting', gloss: 'Give me time and gentle help' },
  { key: 'trying', title: 'Ready to try', gloss: 'I might need a nudge' },
  { key: 'comfortable', title: 'Pretty comfortable', gloss: 'Let’s keep the conversation going' },
];
export const FOCUS_OPTIONS: readonly AnswerOption<PracticeFocus>[] = [
  { key: 'listening', title: 'Listening', gloss: 'Catch more of what you hear' },
  { key: 'speaking', title: 'Speaking', gloss: 'Find the words and say them' },
  { key: 'words', title: 'Useful words', gloss: 'Build a little everyday vocabulary' },
];

export const DEFAULT_START_LEVEL: StartLevel = 'zero';

/** What's it for? One tap, and skippable. */
export const REASONS: readonly AnswerOption<Reason>[] = [
  { key: 'food', title: 'Ordering food and drinks' },
  { key: 'trip', title: 'Getting around on a trip' },
  { key: 'family', title: 'Talking with friends or family' },
  { key: 'moving', title: 'Everyday life after a move' },
  { key: 'work', title: 'Simple conversations at work' },
  { key: 'because', title: 'Just exploring' },
];

/**
 * One fixed line per reason, written as the learner's own goal through
 * `withLearnerGoal` at account creation. The tutor reads it from the session
 * snapshot on the first join, which is after the save page.
 */
export const SEEDED_GOAL: Readonly<Record<Reason, string>> = {
  food: 'Order food and drinks in French at a café or a restaurant.',
  trip: 'Get by in French on my next trip: train tickets, directions, the hotel.',
  family: 'Talk with my partner, family and friends in French.',
  moving: 'Handle everyday life in French after a move: renting a flat, the doctor, the neighbours.',
  work: 'Use French with confidence at work, with colleagues and on the phone.',
  because: 'Enjoy speaking French, just because.',
};

const ORDER = ['A0', 'A1', 'A2', 'B1'] as const;
const atOrAbove = (id: MissionId, placement: Placement): boolean =>
  ORDER.indexOf((getMission(id)?.cefr ?? 'A0') as (typeof ORDER)[number]) >= ORDER.indexOf(PLACEMENT_CEFR[placement]);

/** The spine from the learner's placement on: the stages below it stay open to visit, just not suggested. */
export function sceneOrder(level: StartLevel, skipAhead = false): readonly MissionId[] {
  const placement = placementFor(level, skipAhead);
  return placement === null ? SCENE_SPINE : SCENE_SPINE.filter((id) => atOrAbove(id, placement));
}

/** The goal's scenes the plan suggests: within reach from A0 with no placement, else at the placement's level. */
function goalScenesFor(reason: Reason | null | undefined, placement: Placement | null): readonly MissionId[] {
  if (placement === null) return goalReachScenes(reason);
  if (!reason || reason === 'because') return [];
  return GOAL_SCENES[reason].filter((id) => getMission(id)?.cefr === PLACEMENT_CEFR[placement]);
}

/** The goal's scenes within reach from A0 (mission cefr A0 or A1); none for 'because' or no goal. */
export function goalReachScenes(reason: Reason | null | undefined): readonly MissionId[] {
  if (!reason || reason === 'because') return [];
  return GOAL_SCENES[reason].filter((id) => {
    const cefr = getMission(id)?.cefr;
    return cefr === 'A0' || cefr === 'A1';
  });
}

/**
 * The scene the first run opens on after the account is made. Brand new and a
 * few words open on the spine's opener, the same scene core's `nextScene`
 * offers before anything is earned. A learner who can get by starts on the
 * first A0 or A1 scene of their goal; with no goal, 'because', or no such
 * scene, it is the level's first scene on the spine.
 */
export function firstSceneFor(level: StartLevel | null, reason?: Reason | null, skipAhead = false): MissionId {
  const start = level ?? DEFAULT_START_LEVEL;
  const placement = placementFor(start, skipAhead);
  if (placement !== null) {
    const fit = goalScenesFor(reason, placement)[0];
    if (fit) return fit;
  }
  return sceneOrder(start, skipAhead)[0]!;
}

/** Minutes a day to suggest: work and a move ask for more; otherwise the level decides. */
export function presetMinutes(level: StartLevel, reason: Reason | null): PlanMinutes {
  if (reason === 'work' || reason === 'moving') return 15;
  return level === 'zero' ? 5 : 10;
}

/**
 * The starting point as the brain's estimate: no placement is A0, Basics A1,
 * Everyday A2, always at low confidence, because it is a self-report and the
 * first real evidence replaces it.
 */
export function startEstimate(level: StartLevel, skipAhead = false): { estimate: 'A0' | 'A1' | 'A2'; confidence: 'low' } {
  const placement = placementFor(level, skipAhead);
  return { estimate: placement === null ? 'A0' : PLACEMENT_CEFR[placement], confidence: 'low' };
}

export function placementOf(draft: PreAccountOnboardingDraft): Placement | null {
  return placementFor(draft.startLevel, draft.skipAhead === true);
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
  /** One deduplicated sentence pair: how the first practice starts, then the focus. */
  method: string;
  /** "Gentle pace" for a hesitant learner, else null. */
  gentle: string | null;
  /** The stage the learner starts at, 0 Starter to 2 Everyday. */
  stage: number;
  heading: string;
  /** True only at Basics, where "Skip ahead" moves the start to Everyday. */
  canSkipAhead: boolean;
  /** True once skipped from Basics, where "Start at Basics" undoes it. */
  canUndoSkip: boolean;
  tutorGoals: readonly string[];
  reminder: { time: ReminderTimeId; clock: string; note: string };
}

/** The stage words, as `BOnboardingParts.tsx` PLAN_STAGES and the Journey say them. */
const STAGE_WORDS = ['Starter', 'Basics', 'Everyday', 'Chatting', 'Confident'] as const;

export const PLAN_TITLE = 'Your plan';
export const PLAN_SCENES_LABEL = 'Your first three scenes';
export const MINUTES_LABEL = 'A flexible starting routine';
export const GOAL_LABEL = 'Your goal';
export const GOAL_NOTE = 'This goal chooses your first practice and guides your tutor.';
export const METHOD_LABEL = 'How it works';
export const METHOD_STEPS: readonly string[] = [
  'Talk through a real scene, one line at a time.',
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
  if (level === 'getby' || level === 'confident') return 'Start with a French prompt. Help is available whenever you need it.';
  return level === 'few' ? 'Try your own reply, with translation and help available.' : 'Start with a sentence starter and translation. Help is available.';
}

/**
 * How the first practice starts and what it leans on, as one sentence pair
 * with no idea said twice (F916). The first sentence comes from confidence,
 * then level; the second from focus. A hesitant learner also gets "Gentle
 * pace", which says only what the code does: the practice starts typed
 * (`initialPracticeMode`, `withPreferTyping`) and the tutor is given the
 * gentle-start goal (`SUPPORT_GOALS.hesitant`).
 */
export const GENTLE_PACE = 'Gentle pace. You start by typing, and your tutor is asked to go gently.';
export const SKIP_AHEAD = 'Skip ahead';
export const SKIP_AHEAD_HINT = 'Start at Everyday instead. Basics stays open to visit.';
export const START_AT_BASICS = 'Start at Basics';
export const START_AT_BASICS_HINT = 'Go back to starting at Basics.';

function startSentence(draft: PreAccountOnboardingDraft): string {
  if (draft.speakingConfidence === 'hesitant') return 'Start with a model line and its translation.';
  const level = levelOf(draft);
  if (level === 'getby' || level === 'confident') return 'Start with a French prompt.';
  return level === 'few' ? 'Try your own reply, with translation if you need it.' : 'Start with a sentence starter and its translation.';
}

function focusSentence(draft: PreAccountOnboardingDraft): string {
  const hesitant = draft.speakingConfidence === 'hesitant';
  if (draft.practiceFocus === 'listening') return 'Replay the French as often as you like before you answer.';
  if (draft.practiceFocus === 'words') return 'Build your answer from useful words.';
  if (draft.practiceFocus === 'speaking') return hesitant ? 'Say your answer aloud whenever you’re ready.' : 'Answer out loud, with help one tap away.';
  return hesitant ? 'Take each line one step at a time.' : 'Help is there whenever you need it.';
}

export function methodLines(draft: PreAccountOnboardingDraft): { method: string; gentle: string | null } {
  return { method: `${startSentence(draft)} ${focusSentence(draft)}`, gentle: draft.speakingConfidence === 'hesitant' ? GENTLE_PACE : null };
}

/**
 * What the plan says comes first (F916, verifier 2026-10-29). Before an
 * account, Start live practice plays the scripted guest café, but the consent
 * sheet's "Create an account first" skips it, so the café is named only as
 * what can be tried now. Scene 1 is named as the plan's first scene on every
 * path, because the account opens on it either way (`firstSceneFor`).
 * "Coming up" names the goal scene when it differs.
 */
export function firstConversationLines(draft: PreAccountOnboardingDraft, where: { guestScene: boolean }): { tryNow: string | null; first: string; comingUp: string | null } {
  const sceneOne = firstSceneFor(draft.startLevel, draft.reason, draft.skipAhead === true);
  const outcome = (id: MissionId) => getMission(id)!.canDoEn.toLocaleLowerCase();
  const goal = goalScenesFor(draft.reason, placementOf(draft))[0];
  return {
    tryNow: where.guestScene ? `Try it now: ${GUEST_CAFE_SCENE.titleEn.toLocaleLowerCase()}.` : null,
    first: `First scene in your plan: ${outcome(sceneOne)}.`,
    comingUp: goal !== undefined && goal !== sceneOne && outcome(goal) !== outcome(sceneOne) ? `Coming up: ${outcome(goal)}.` : null,
  };
}

/** Confidence chooses scaffolding, even for a learner who knows some French. */
export function startingSupport(draft: PreAccountOnboardingDraft): string {
  if (draft.speakingConfidence === 'hesitant') return 'Start with a model and translation. Try your reply when you’re ready.';
  return startingReasonFor(levelOf(draft));
}

/** The caller must also gate spoken mode on the actual service capability. */
export function initialPracticeMode(draft: PreAccountOnboardingDraft): 'typed' | 'spoken' {
  return draft.practiceFocus === 'speaking' && draft.speakingConfidence !== 'hesitant' ? 'spoken' : 'typed';
}

const FOCUS_GOALS: Readonly<Record<PracticeFocus, string>> = {
  listening: 'Understand spoken French with a model I can replay before replying.',
  speaking: 'Practise speaking French out loud with support when I need it.',
  words: 'Find useful French words and build my own replies with translation help.',
};
const SUPPORT_GOALS: Readonly<Record<SpeakingConfidence, string>> = {
  hesitant: 'Start gently with a model and translation before I try a reply.',
  trying: 'Give me space to try a reply, with help available when I get stuck.',
  comfortable: 'Let me try conversations first, with help available when I ask.',
};

/** Every saved goal represents a real answer and fits the existing three-goal store. */
export function tutorGoalsFor(draft: PreAccountOnboardingDraft): readonly string[] {
  return [
    ...(draft.reason === null ? [] : [SEEDED_GOAL[draft.reason] + (draft.interests?.length ? ` Interests: ${draft.interests.map(i => ({ food: 'food and cafés', travel: 'travel and places', music: 'music and films', everyday: 'everyday life' })[i]).join(', ')}.` : '')]),
    ...(draft.practiceFocus == null ? [] : [FOCUS_GOALS[draft.practiceFocus]]),
    ...(draft.speakingConfidence == null ? [] : [SUPPORT_GOALS[draft.speakingConfidence]]),
  ];
}

export interface PracticeForecast {
  days: 90;
  dailyMinutes: 5 | 10 | 15 | 20;
  totalMinutes: number;
  hours: number;
  /** Arithmetic, not a predicted proficiency or a guaranteed conversation date. */
  line: string;
}

export function practiceForecast(minutes: PlanMinutes | null | undefined): PracticeForecast | null {
  if (minutes == null || minutes === 'none') return null;
  const totalMinutes = minutes * 90;
  const hours = totalMinutes / 60;
  return { days: 90, dailyMinutes: minutes, totalMinutes, hours,
    line: `${minutes} minutes a day adds up to ${hours} hours of French practice over 90 days.` };
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

/** True: the free plan is one conversation every other day, for nothing (REV-001). */
export const TRIAL_LINE = 'One free conversation every other day, no card needed';

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
  GENTLE_PACE,
  SKIP_AHEAD,
  SKIP_AHEAD_HINT,
  START_AT_BASICS,
  START_AT_BASICS_HINT,
  NO_STREAKS,
  REMINDER_LABEL,
  REMINDER_NOT_ON,
  SAVE_PLAN,
  TRIAL_LINE,
];

/** The whole plan, from the draft as it stands. */
export function planFor(draft: PreAccountOnboardingDraft): PlanView {
  const skipAhead = draft.skipAhead === true;
  const placement = placementOf(draft);
  const first = firstSceneFor(draft.startLevel, draft.reason, skipAhead);
  // Mirrors core's nextScene: after the opener, the goal's scenes lead.
  const scenes = [...new Set([first, ...goalScenesFor(draft.reason, placement), ...sceneOrder(levelOf(draft), skipAhead)])]
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
    starter: starterTasks(draft.reason, draft.drink ?? 'coffee', starterMinutes(minutesOf(draft)))[0]!,
    minutes: minutesOf(draft),
    goal: draft.reason === null ? null : SEEDED_GOAL[draft.reason],
    startingReason: startingSupport(draft),
    ...methodLines(draft),
    stage: placementStage(placement),
    heading: `You start at ${STAGE_WORDS[placementStage(placement)]}`,
    canSkipAhead: canSkipAhead(draft.startLevel, skipAhead),
    canUndoSkip: skipAhead && draft.startLevel === 'getby',
    tutorGoals: tutorGoalsFor(draft),
    reminder: { time, clock: reminderTime(time).gloss, note: REMINDER_NOT_ON },
  };
}
