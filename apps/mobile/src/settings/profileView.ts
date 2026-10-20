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

import { GAME_COPY } from '../game/copy.ts';
import { GOAL_CHOICES, goalChoiceOf } from '../game/profileStatsView.ts';
import { PLAN_LABELS, planSentence, type PlanStatusView } from '../purchases/planStatus.ts';
import { STATED_LEVEL_OPTIONS, type StatedLevel } from '../profile/practicePreferences.ts';
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

// ─────────────────────────────────────────────────── learning preferences

export const LEARNING_PREFERENCES_TITLE = 'Learning preferences';
export const LEARNING_PREFERENCES_INTRO = 'These shape how your tutor talks with you. They never change the level you’ve earned.';
export const ROUTINE_GROUP = 'Routine';
export const TUTOR_HELPS_GROUP = 'How your tutor helps';
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
  PROFILE_TITLE, EDIT_NAME_LINK, LEARNING_GROUP, YOUR_FRENCH_GROUP, PLAN_GROUP_TITLE,
  LEARNING_PREFERENCES_ROW, TUTOR_VOICE_ROW, TUTOR_MEMORY_ROW, TUTOR_MEMORY_SUB,
  PROGRESS_ROW, MY_FRENCH_ROW, FRIENDS_ROW, FRIENDS_SUB, NAME_UNSET,
  LEARNING_PREFERENCES_TITLE, LEARNING_PREFERENCES_INTRO, ROUTINE_GROUP, TUTOR_HELPS_GROUP,
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

/** Whether a stored plan view is the free plan (D24: five minutes every week). */
function isFree(view: Extract<PlanStatusView, { known: true }>): boolean {
  return view.planLabel === PLAN_LABELS.trial;
}

/**
 * The plan row on Profile and in Settings.
 *
 * Unanswered says it is checking; unknown says it could not check; neither
 * names a plan, and above all neither says Free.
 */
export function planRow(view: PlanStatusView | null): { label: string; sub: string } {
  if (view === null) return { label: PLAN_GROUP_TITLE, sub: PLAN_CHECKING };
  if (!view.known) return { label: PLAN_GROUP_TITLE, sub: PLAN_UNKNOWN_TITLE };
  return { label: isFree(view) ? PLAN_FREE_TITLE : view.planLabel, sub: planSentence(view.bandLine, view.periodLine) };
}

export type SubscriptionView =
  | { kind: 'checking' }
  | { kind: 'unknown'; title: string; body: string }
  | { kind: 'free'; title: string; period: string; band: string }
  | { kind: 'paid'; title: string; period: string; band: string };

/** What the Subscription screen draws, decided once. */
export function subscriptionView(view: PlanStatusView | null): SubscriptionView {
  if (view === null) return { kind: 'checking' };
  if (!view.known) return { kind: 'unknown', title: PLAN_UNKNOWN_TITLE, body: PLAN_UNKNOWN_BODY };
  if (isFree(view)) return { kind: 'free', title: PLAN_FREE_TITLE, period: view.periodLine, band: view.bandLine };
  return { kind: 'paid', title: view.planLabel, period: view.periodLine, band: view.bandLine };
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
