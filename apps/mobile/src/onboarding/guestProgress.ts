/**
 * What a first-run guest has, as plain data (come alive, first run section 3.7).
 *
 * Pure: no storage, no network and no renderer, so the rules here are tested
 * directly and every screen that needs one of them asks this module rather than
 * deciding for itself.
 *
 * - `starterMinutes`: the daily goal a learner chose, as the starter service and
 *   `starterTasks` know it. The goal page offers Intense, twenty minutes a day
 *   (founder decision D5); the service validates 5, 10, 15 and "choose each
 *   time", and a twenty-minute goal runs the same three exchanges as fifteen.
 *   Every path that sends minutes or builds the starter tasks goes through here,
 *   so a twenty never reaches the server and is never refused there.
 * - `keptPhrase`: the line a kept first-run phrase stores. Always the task's
 *   natural line, never what the learner typed or what a recogniser heard: an
 *   accepted reply is checked against a short list of authored answers, not for
 *   spelling, so the learner's own words can carry a typo into the phrasebook
 *   and onto Home (F757).
 * - `savedPhraseTasks`: the tasks whose natural line a guest's practice saves,
 *   so the hand-off and the guest home never name a phrase that is not saved.
 * - `keepFinishes`: a new practice carries the days the guest already finished
 *   (F751), so starting again never takes a finished day away.
 * - `guestStreak`, `guestInvestment` and `resumePage`: day one, the save card
 *   and where a resumed first run opens (README Part 5.C rows 9 and 10). Every
 *   number comes from the finish days the guest record holds
 *   (`guestModel.ts` `guestPracticeDays`), which the screen passes in.
 */

import { addDays, starterTasks, streakFrom, tutorVoice, weekdayIndex, WEEKDAY_NAMES, type DayKey, type StarterTask, type WeekCell, type WeekdayLetter } from '@luvani/core';
import { GAME_COPY } from '../game/copy.ts';
import type { BulkIconName } from '../icons/names.ts';
import { reminderTime } from '../reminders/reminder.ts';
import { KEEP_ROWS } from './firstRun/copy.ts';
import type { GuestPractice } from './guestModel.ts';
import type { PlanMinutes, PreAccountOnboardingDraft, PreAccountPage } from './preAccountDraft.ts';

/** The minutes the starter service and `starterTasks` accept. */
export type StarterMinutes = 5 | 10 | 15 | 'none';

/** The chosen daily goal as the starter knows it: twenty runs as fifteen, nothing chosen runs as five. */
export function starterMinutes(minutes: PlanMinutes | null | undefined): StarterMinutes {
  if (minutes === 20) return 15;
  return minutes ?? 5;
}

/** The French a kept first-run phrase saves: the task's natural line (F757). */
export function keptPhrase(task: Pick<StarterTask, 'model'>): string {
  return task.model;
}

/**
 * The tasks whose natural line a guest's practice saves, oldest first: one for
 * each reply that was accepted or kept, and the last reply when the practice
 * itself was kept. The hand-off writes exactly these to the phrasebook, and the
 * hand-off card and the guest home show the newest of them, so neither ever
 * names a refused line that was never saved.
 */
export function savedPhraseTasks(practice: Pick<GuestPractice, 'attempts' | 'kept' | 'plan'> | null): StarterTask[] {
  if (practice === null) return [];
  const tasks = starterTasks(practice.plan.reason, practice.plan.drink ?? 'coffee', starterMinutes(practice.plan.minutes));
  const last = practice.attempts.length - 1;
  return practice.attempts
    .filter((attempt, index) => attempt.feedback.accepted || attempt.kept === true || (practice.kept && index === last))
    .map((attempt) => tasks.find((task) => task.id === attempt.taskId))
    .filter((task): task is StarterTask => task !== undefined);
}

/**
 * A new practice, with the finish days the one before it held (F751).
 *
 * A guest record is replaced when a practice starts on a new plan or a new
 * capability; the days already finished are facts about this phone, not about
 * that practice, so they carry over. A new record that already holds days
 * keeps its own, and nothing is added: a carried day is never a new finish.
 */
export function keepFinishes<T extends Pick<GuestPractice, 'finishedAt'>>(next: T, prior: Pick<GuestPractice, 'finishedAt'> | null | undefined): T {
  if (next.finishedAt?.length || !prior?.finishedAt?.length) return next;
  return { ...next, finishedAt: [...prior.finishedAt] };
}

/** Day one, and the guest home's streak card, from the days a practice was finished. */
export interface GuestStreak {
  /** Practice days in the live run. At least 1, or there is no streak to show. */
  readonly current: number;
  /** The run before today's finish: the number day one counts up from. */
  readonly before: number;
  /** Whether today is one of the days: the flame is lit, not waiting. */
  readonly todayPractised: boolean;
  /** Today first, then the next six local calendar days. Future dots stay neutral. */
  readonly week: readonly WeekCell[];
  /** Day one's title. */
  readonly title: string;
}

/**
 * The guest's run, or null when there is none to show.
 *
 * Counted by core's streak rule from the finish days alone: no cover, no
 * account and no guess. A run that has lapsed is null rather than a 0, so no
 * page ever says "0 days".
 */
export function guestStreak(days: readonly DayKey[], today: DayKey): GuestStreak | null {
  const input = { practiceDays: days, covers: [], today };
  const state = streakFrom(input);
  if (state.current < 1) return null;
  const todayPractised = state.today === 'practised';
  return {
    current: state.current,
    before: todayPractised ? state.current - 1 : state.current,
    todayPractised,
    week: upcomingPracticeDays(today, todayPractised),
    // A later day of a run says what is true of today; day one, or a run
    // whose newest day was yesterday, says the run has started.
    title: state.current > 1 && todayPractised ? GAME_COPY.streak.line(state.current) : GAME_COPY.streak.started,
  };
}

/** A calendar strip anchored to the learner's current day, safe across DST and month ends. */
export function upcomingPracticeDays(today: DayKey, todayPractised: boolean): readonly WeekCell[] {
  const letters: readonly WeekdayLetter[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return Array.from({ length: 7 }, (_, index): WeekCell => {
    const day = addDays(today, index);
    const weekday = weekdayIndex(day);
    return { day, label: letters[weekday]!, name: WEEKDAY_NAMES[weekday]!, cover: null,
      state: index === 0 ? todayPractised ? 'practised' : 'today-open' : 'ahead' };
  });
}

/** One line on the save card. */
export interface InvestmentRow {
  readonly key: 'streak' | 'replies' | 'kept' | 'plan' | 'tutor' | 'reminder';
  readonly icon: BulkIconName;
  readonly text: string;
}

/**
 * What this phone holds, as the save card lists it (README Part 5.C row 10),
 * each row only when it is true:
 *
 * - the live run, from the finish days;
 * - replies that work: accepted replies the learner gave, typed or spoken (a
 *   played model is accepted and is nobody's reply);
 * - phrases kept, from the guest record: one per task, because a kept phrase
 *   is always that task's natural line, so keeping it twice is one phrase;
 * - the plan the practice ran on: its first task and the daily goal;
 * - the tutor chosen on this phone (the default counts: it is the plan's);
 * - the reminder, only once one is really scheduled (`reminderEnabled` is set
 *   only after the OS took it).
 */
export function guestInvestment(input: {
  practice: Pick<GuestPractice, 'attempts' | 'kept' | 'plan'> | null;
  /** `guestPracticeDays(practice)`: the days this phone saw a practice finished. */
  days: readonly DayKey[];
  today: DayKey;
  draft: Pick<PreAccountOnboardingDraft, 'tutorVoice' | 'reminderEnabled' | 'reminderTime'>;
}): InvestmentRow[] {
  const { practice, days, today, draft } = input;
  const rows: InvestmentRow[] = [];
  const run = guestStreak(days, today);
  if (run !== null) rows.push({ key: 'streak', icon: 'flame', text: GAME_COPY.streak.dayOf(run.current) });
  const attempts = practice?.attempts ?? [];
  const working = attempts.filter((attempt) => attempt.feedback.accepted && attempt.feedback.evidence !== 'model').length;
  if (working > 0) rows.push({ key: 'replies', icon: 'chat', text: KEEP_ROWS.replies(working) });
  const keptTasks = new Set(attempts.filter((attempt) => attempt.kept === true).map((attempt) => attempt.taskId));
  const newest = attempts.at(-1);
  if (practice?.kept === true && newest !== undefined) keptTasks.add(newest.taskId);
  const kept = keptTasks.size;
  if (kept > 0) rows.push({ key: 'kept', icon: 'bookmark', text: KEEP_ROWS.kept(kept) });
  if (practice !== null) {
    const plan = practice.plan;
    const first = starterTasks(plan.reason, plan.drink ?? 'coffee', starterMinutes(plan.minutes))[0];
    if (first) rows.push({ key: 'plan', icon: 'calendar', text: KEEP_ROWS.plan(first.title, typeof plan.minutes === 'number' ? plan.minutes : null) });
  }
  rows.push({ key: 'tutor', icon: 'user', text: KEEP_ROWS.tutor(tutorVoice(draft.tutorVoice).persona.name) });
  if (draft.reminderEnabled === true) rows.push({ key: 'reminder', icon: 'bell', text: KEEP_ROWS.reminder(reminderTime(draft.reminderTime).gloss) });
  return rows;
}

/** The pages that need a guest record on this phone. */
export const GUEST_PAGES: readonly PreAccountPage[] = ['practice', 'recap', 'remind', 'keep', 'home'];

/**
 * Where a resumed first run opens.
 *
 * Without a guest record a guest page has nothing to show, so the plan opens.
 * Day one, and the reminder ask on it, come only after a finished practice
 * (F754): with no finish day on this phone it is the plan, and with a run that
 * has since lapsed there is no day one to show, so the save card opens. The
 * save card and the guest home need a finished practice too: a guest home
 * saved before finishes were kept opens the win, whose Continue finishes the
 * practice, so the home's Set a reminder never comes before a finish.
 */
export function resumePage(page: PreAccountPage, hasGuest: boolean, days: readonly DayKey[], today: DayKey): PreAccountPage {
  if (!GUEST_PAGES.includes(page)) return page;
  if (!hasGuest) return 'plan';
  if (page === 'remind') return guestStreak(days, today) !== null ? 'remind' : days.length > 0 ? 'keep' : 'plan';
  if (page === 'keep') return days.length > 0 ? 'keep' : 'plan';
  if (page === 'home') return days.length > 0 ? 'home' : 'recap';
  return page;
}
