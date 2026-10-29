/**
 * Every judgement the P2 Profile, Learning preferences and Subscription screens
 * would otherwise make in JSX, and every word they say (2026-10-19).
 *
 * No renderer in this suite (docs/TESTING.md), so the rules live here and the
 * `.tsx` files only lay them out: which line summarises the learner's
 * preferences, what the plan row says when the server has not answered or
 * cannot be reached, whether the trial reminder switch is drawn, and which of
 * the four starting points is current.
 *
 * ## The plan is never called Free when it is unknown
 *
 * `planStatusFor` answers `known: false` when the server could not be asked.
 * A learner who pays and is offline must not be told they are on the free
 * minutes, so an unknown plan has its own words and never borrows a plan name.
 *
 * ## No counts on the plan (F377, F541)
 *
 * Speaking time is a band in words, as `purchases/planStatus.ts` hands it over.
 * The supplied design drew "n of m min left" and a renewal date; neither is
 * drawn, for the reason `planStatus.ts` gives: a falling number is a scarcity
 * mechanic, and a date reads as a deadline.
 */

import { PLANS } from '@luvani/core';

import { GAME_COPY } from '../game/copy.ts';
import { streakDays } from '../game/todayHeroView.ts';
import { GOAL_CHOICES, goalChoiceOf } from '../game/profileStatsView.ts';
import { PLAN_LABELS, planSentence, RENEWAL_POINTERS, type PlanStatusView } from '../purchases/planStatus.ts';
import { STATED_LEVEL_OPTIONS, type StatedLevel } from '../profile/practicePreferences.ts';
import { REASONS } from '../onboarding/plan.ts';
import { isLearnerGoal, type LearnerGoal } from '@luvani/core';
import { STRICTNESS_OPTIONS, type Strictness } from '../tutor/strictness.ts';

// ───────────────────────────────────────────────────────────────── profile

export const PROFILE_TITLE = 'Profile';
export const EDIT_NAME_LINK = 'Edit';
export const LEARNING_GROUP = 'Learning';
export const YOUR_FRENCH_GROUP = 'Your French';
export const PLAN_GROUP_TITLE = 'Plan';
export const LEARNING_PREFERENCES_ROW = 'Learning preferences';
export const TUTOR_VOICE_ROW = 'Tutor voice';
export const TUTOR_MEMORY_ROW = 'Tutor memory';
export const TUTOR_MEMORY_SUB = 'What your tutor remembers about you';
export const PROGRESS_ROW = 'Progress';
export const MY_FRENCH_ROW = 'My French';
export const FRIENDS_ROW = 'Friends';
export const FRIENDS_SUB = 'Optional shared practice';
export const NAME_UNSET = 'You';

// ─────────────────────────────────── the B profile (2026-10-20 UI-008, artboard B-Profile)

export const MORE_GROUP = 'More';
export const YOUR_TUTOR_ROW = 'Your tutor';
export const MEMORY_PROFILE_SUB = 'See it, change it, or forget any of it';
export const JOURNEY_ROW = 'Your journey';
export const JOURNEY_SUB = 'Stages, abilities and then and now';
export const SAVED_PHRASES_ROW = 'Saved phrases';
export const SOUNDS_ROW = 'Your sounds';
export const SOUND_READY = 'One sound is ready to revisit';
export const HELP_FEEDBACK_ROW = 'Help and feedback';
export const PRIVACY_ROW = 'Privacy';
export const PRIVACY_SUB = 'What we keep and why';
export const PLAN_EYEBROW = 'Your plan';

/** "What Alexandre remembers", the memory row's title on Profile. */
export function memoryRowTitle(tutorName: string): string {
  return `What ${tutorName} remembers`;
}

/** The stage the learner is at, "Starter", from Journey's own five stages. Null with no step marked here. */
export function stageWordOf(view: { steps: readonly { label: string; state: string }[] }): string | null {
  return view.steps.find((step) => step.state === 'here')?.label ?? null;
}

/** "8 saved": the deck's saved phrases, as Practice counts them. Null with none, and the row carries no second line. */
export function savedCount(saved: number): string | null {
  return Number.isFinite(saved) && saved > 0 ? `${Math.floor(saved)} saved` : null;
}

/** The sounds row's line: only while the sound journey holds a sound to revisit. */
export function soundsLine(hasJourney: boolean): string | null {
  return hasJourney ? SOUND_READY : null;
}

export interface ProfileStat {
  key: 'stage' | 'level' | 'streak';
  /** Null while unread: the cell keeps its place and draws no number. */
  value: string | null;
  label: string;
  route: 'MyFrench' | 'Streak';
}

/**
 * The three cells of the stats card: the stage, the level over its XP, the
 * run over "streak". With no run the cell says how one starts, as Today's
 * tile does ("Practice", "not yet today"), never a nought.
 */
export function profileStats(input: { stage: string | null; level: number | null; xpTotal: number | null; streak: number | null }): ProfileStat[] {
  const level = input.level !== null && Number.isFinite(input.level) ? GAME_COPY.level.title(Math.max(0, Math.floor(input.level))) : null;
  const xp = input.xpTotal !== null && Number.isFinite(input.xpTotal) ? `${Math.max(0, Math.floor(input.xpTotal))} XP` : 'XP';
  const run = input.streak === null ? null : Math.max(0, Math.floor(input.streak));
  return [
    { key: 'stage', value: input.stage, label: 'stage', route: 'MyFrench' },
    { key: 'level', value: level, label: xp, route: 'MyFrench' },
    run === null
      ? { key: 'streak', value: null, label: 'streak', route: 'Streak' }
      : run === 0
        ? { key: 'streak', value: 'Practice', label: 'not yet today', route: 'Streak' }
        : { key: 'streak', value: streakDays(run), label: 'streak', route: 'Streak' },
  ];
}

/**
 * What the free plan includes, from the plan facts: practice and review, the
 * free plan's speaking allowance (core's PLANS, the number the wall and
 * onboarding say), and the freezes it holds (D23), as the game view read
 * them from the plan; without that read the freeze clause is left out.
 */
export function freeIncludes(freezes: number | null): string {
  const minutes = Math.round(PLANS.trial.secondsPerPeriod / 60);
  const speaking = `a free ${minutes}-minute conversation every other day`;
  if (freezes === null || !Number.isFinite(freezes) || freezes < 1) return `Practice and review, and ${speaking}`;
  return `Practice and review, ${speaking}, and ${freezes} streak ${freezes === 1 ? 'freeze' : 'freezes'}`;
}

export interface PlanCardView {
  title: string | null;
  line: string;
  action: string;
  /** Free goes to the plans; anything else to the Subscription screen. */
  target: 'Wall' | 'Subscription';
}

/** The blue plan card. Unread and unknown name no plan and are never called Free. */
export function planCard(view: PlanStatusView | null, freezes: number | null = null, renewal: RenewalLines = null): PlanCardView {
  if (view === null) return { title: null, line: PLAN_CHECKING, action: COMPARE_PLANS_ROW, target: 'Subscription' };
  if (!view.known) return { title: null, line: PLAN_UNKNOWN_TITLE, action: COMPARE_PLANS_ROW, target: 'Subscription' };
  if (isFree(view)) return { title: PLAN_FREE_TITLE, line: freeIncludes(freezes), action: SEE_PLANS_ROW, target: 'Wall' };
  return { title: view.planLabel, line: planSentence(view.bandLine, renewal?.short ?? view.periodLine), action: COMPARE_PLANS_ROW, target: 'Subscription' };
}

// ─────────────────────────────────────────────────── learning preferences

export const LEARNING_PREFERENCES_TITLE = 'Learning preferences';
export const LEARNING_PREFERENCES_INTRO = 'These shape how your tutor talks with you. They never change the level you’ve earned.';
export const ROUTINE_GROUP = 'Routine';
export const TUTOR_HELPS_GROUP = 'How your tutor helps';
// The onboarding goal, changed or cleared after onboarding. It reorders
// suggested scenes and never moves the level earned.
export const GOAL_GROUP = 'Your goal';
export const GOAL_ROW = 'What you’re learning for';
export const GOAL_UNSET = 'Not chosen yet';
export const GOAL_SHEET_TITLE = 'Your goal';
export const GOAL_FOOTER = 'Your goal puts its scenes first in what we suggest. Changing it never changes the level you’ve earned.';
export const GOAL_CLEAR = 'Nothing in particular';
/** The six onboarding reasons, worded as onboarding words them, then the clear. */
export const GOAL_OPTIONS: readonly { key: LearnerGoal | null; title: string }[] = [
  ...REASONS.map((reason) => ({ key: reason.key as LearnerGoal, title: reason.title })),
  { key: null, title: GOAL_CLEAR },
];

export const STARTING_POINT_GROUP = 'Conversation starting point';
export const STARTING_POINT_ROW = 'Where conversations start';
export const STARTING_POINT_UNSET = 'Not chosen yet';
export const STARTING_POINT_SHEET_TITLE = 'Conversation starting point';

// ──────────────────────────────────────────────────────────── subscription

export const SUBSCRIPTION_TITLE = 'Subscription';
export const PLAN_CHECKING = 'Checking your plan…';
export const PLAN_UNKNOWN_TITLE = 'We couldn’t check your plan';
export const PLAN_UNKNOWN_BODY = 'Your saved learning is safe. Check your connection and try again.';
export const PLAN_RETRY = 'Try again';
export const PLAN_FREE_TITLE = 'Free';
export const TUTOR_TIME_TITLE = 'Tutor time';
export const MANAGE_APPLE_ROW = 'Manage in Apple Subscriptions';
export const COMPARE_PLANS_ROW = 'Compare plans';
export const SEE_PLANS_ROW = 'See plans';
export const NEXT_RENEWAL_ROW = 'Next renewal';
export const CANCEL_FOOTER = 'To avoid the next charge, cancel at least 24 hours before renewal.';
export const REMINDERS_FOOTER = 'Reminders need notifications turned on for Luvani.';

/** Every line above, for the em dash and guilt sweeps. */
export const PROFILE_VIEW_COPY: readonly string[] = [
  MORE_GROUP, YOUR_TUTOR_ROW, MEMORY_PROFILE_SUB, JOURNEY_ROW, JOURNEY_SUB, SAVED_PHRASES_ROW, SOUNDS_ROW,
  SOUND_READY, HELP_FEEDBACK_ROW, PRIVACY_ROW, PRIVACY_SUB, PLAN_EYEBROW,
  PROFILE_TITLE, EDIT_NAME_LINK, LEARNING_GROUP, YOUR_FRENCH_GROUP, PLAN_GROUP_TITLE,
  LEARNING_PREFERENCES_ROW, TUTOR_VOICE_ROW, TUTOR_MEMORY_ROW, TUTOR_MEMORY_SUB,
  PROGRESS_ROW, MY_FRENCH_ROW, FRIENDS_ROW, FRIENDS_SUB, NAME_UNSET,
  LEARNING_PREFERENCES_TITLE, LEARNING_PREFERENCES_INTRO, ROUTINE_GROUP, TUTOR_HELPS_GROUP,
  GOAL_GROUP, GOAL_ROW, GOAL_UNSET, GOAL_SHEET_TITLE, GOAL_FOOTER, GOAL_CLEAR,
  STARTING_POINT_GROUP, STARTING_POINT_ROW, STARTING_POINT_UNSET, STARTING_POINT_SHEET_TITLE,
  SUBSCRIPTION_TITLE, PLAN_CHECKING, PLAN_UNKNOWN_TITLE, PLAN_UNKNOWN_BODY, PLAN_RETRY,
  PLAN_FREE_TITLE, TUTOR_TIME_TITLE, MANAGE_APPLE_ROW, COMPARE_PLANS_ROW, SEE_PLANS_ROW,
  NEXT_RENEWAL_ROW, CANCEL_FOOTER, REMINDERS_FOOTER,
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "Learning French since October 2026", from the day onboarding finished, or
 * null when the profile does not carry a usable one. Read in the phone's own
 * time zone, because that is the month the learner remembers starting in.
 */
export function learningSince(onboardedAt: unknown): string | null {
  if (typeof onboardedAt !== 'number' || !Number.isFinite(onboardedAt) || onboardedAt <= 0) return null;
  const at = new Date(onboardedAt);
  const month = MONTHS[at.getMonth()];
  if (month === undefined || !Number.isFinite(at.getFullYear())) return null;
  return `Learning French since ${month} ${at.getFullYear()}`;
}

/** The initial on the avatar: the first character of the name, or of "You". */
export function initialOf(name: string | null | undefined): string {
  return Array.from(name?.trim() || NAME_UNSET)[0]!.toLocaleUpperCase();
}

/**
 * The one line under Learning preferences: routine · correction style · simpler
 * French. Three of the choices the screen holds, in its order, in their own
 * words, so the row says what is behind it without a count.
 */
export function learningPreferencesSummary(input: { dailyGoalMin: number | null; strictness: Strictness; slow: boolean }): string {
  const goal = GOAL_CHOICES.find((choice) => choice.key === goalChoiceOf(input.dailyGoalMin))?.title ?? GOAL_CHOICES[0]!.title;
  const style = STRICTNESS_OPTIONS.find((option) => option.value === input.strictness)?.label ?? '';
  const parts = [goal, style.length > 0 ? `${style} corrections` : null, input.slow ? 'Simpler French on' : null];
  return parts.filter((part): part is string => part !== null).join(', ');
}

/**
 * The Progress row's subtitle: level, the brain's level estimate, and the
 * lifetime count of practice days, each only when it was read. Null when none
 * of them was, and then the row simply has no second line.
 *
 * The estimate is shown only once the brain is more than tentative about it,
 * which keeps a guess off the screen as a level.
 */
export function progressSummary(input: { level: number | null; cefr: string | null; confidence: string | null; days: number | null }): string | null {
  const parts: string[] = [];
  if (input.level !== null && Number.isFinite(input.level)) parts.push(GAME_COPY.level.title(Math.max(0, Math.floor(input.level))));
  if (input.cefr !== null && input.cefr.length > 0 && input.confidence !== null && input.confidence !== 'low') parts.push(input.cefr);
  if (input.days !== null && Number.isFinite(input.days) && input.days > 0) {
    const days = Math.floor(input.days);
    parts.push(`${days} ${days === 1 ? 'practice day' : 'practice days'}`);
  }
  return parts.length === 0 ? null : parts.join(', ');
}

/** The current starting point's sentence, or the unset line. */
export function statedLevelTitle(level: StatedLevel | null | undefined): string {
  return STATED_LEVEL_OPTIONS.find((option) => option.key === level)?.title ?? STARTING_POINT_UNSET;
}

/** The current goal's onboarding wording, or the unset line for none or an unknown value. */
export function onboardingGoalTitle(goal: unknown): string {
  if (!isLearnerGoal(goal)) return GOAL_UNSET;
  return REASONS.find((reason) => reason.key === goal)?.title ?? GOAL_UNSET;
}

/** Whether a stored plan view is the free plan (REV-001: one free conversation every other day). */
function isFree(view: Extract<PlanStatusView, { known: true }>): boolean {
  return view.planLabel === PLAN_LABELS.trial;
}

/**
 * The plan row on Profile and in Settings.
 *
 * Unanswered says it is checking; unknown says it could not check; neither
 * names a plan, and above all neither says Free.
 */
export function planRow(view: PlanStatusView | null, renewal: RenewalLines = null): { label: string; sub: string } {
  if (view === null) return { label: PLAN_GROUP_TITLE, sub: PLAN_CHECKING };
  if (!view.known) return { label: PLAN_GROUP_TITLE, sub: PLAN_UNKNOWN_TITLE };
  // The short renewal form when the store dated it (F909), else the minutes line.
  return { label: isFree(view) ? PLAN_FREE_TITLE : view.planLabel, sub: planSentence(view.bandLine, isFree(view) ? view.periodLine : renewal?.short ?? view.periodLine) };
}

/**
 * The Free speaking time row on Settings (2026-10-20 UI-008, artboard
 * B-Settings): the free plan's band in REV-001's words ("4 free minutes left,
 * refills on Thursday at 4:10 pm"), never a meter. Null for a paid, unread or unknown plan.
 */
export function freeTimeLine(view: PlanStatusView | null): string | null {
  if (view === null || !view.known || !isFree(view)) return null;
  return view.bandLine;
}

export type SubscriptionView =
  | { kind: 'checking' }
  | { kind: 'unknown'; title: string; body: string }
  | { kind: 'free'; title: string; period: string; band: string }
  | { kind: 'paid'; title: string; band: string; minutes: string; renewal: string };

/** `renewalLines`' answer, or null when there is none. */
export type RenewalLines = { full: string; short: string | null } | null;

/**
 * What the Subscription screen draws, decided once. A paid plan carries the
 * minutes line (the server's window) and the store's renewal line apart (F909);
 * with no renewal answer at all it falls back to the store-neutral pointer, never a date.
 */
export function subscriptionView(view: PlanStatusView | null, renewal: RenewalLines = null): SubscriptionView {
  if (view === null) return { kind: 'checking' };
  if (!view.known) return { kind: 'unknown', title: PLAN_UNKNOWN_TITLE, body: PLAN_UNKNOWN_BODY };
  if (isFree(view)) return { kind: 'free', title: PLAN_FREE_TITLE, period: view.periodLine, band: view.bandLine };
  return { kind: 'paid', title: view.planLabel, band: view.bandLine, minutes: view.periodLine, renewal: renewal?.full ?? RENEWAL_POINTERS.web };
}

/**
 * Whether Settings draws the trial-ending reminder switch: on a build that can
 * schedule one, while the reminders module has a store trial on record. Not
 * permission, not the switch's own position: a learner who turned it off or
 * refused notifications still needs the row to turn it back on.
 */
export function showTrialReminder(input: { available: boolean; onRecord: boolean }): boolean {
  return input.available && input.onRecord;
}
