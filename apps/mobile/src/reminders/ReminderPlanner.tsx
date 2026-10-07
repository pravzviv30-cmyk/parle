/**
 * The planner's hands (Come alive, README Part 5.F): it reads what the learner
 * has done, asks `plan.ts` which days get a reminder, and hands the answer to
 * the OS through `schedule.ts`.
 *
 * This is the one module under `reminders/` that may read practice, and it
 * reads it two ways only: through the game layer for an account (the practice
 * days and covers the streak is counted from, and when each sitting finished),
 * and through the guest record's finish days for a guest who has no account
 * yet. `reminder.test.ts` holds that boundary.
 *
 * It re-plans:
 * - when it mounts, which for an account is after the guest hand-off;
 * - when the app comes back to the foreground, and when it leaves it;
 * - after every settled sitting (`game/settle.ts` `onSettled`), so a practice
 *   skips today's reminder before the evening comes;
 * - when the learner changes their tutor, so the lines name the new one;
 * - when Settings or the ask change the choice (they call `replanReminders`);
 * - for a guest, whenever the first run's draft moves, which it does as soon as
 *   a finished practice is on the disk.
 *
 * Every re-plan runs alone on one chain, so two can never interleave their
 * cancels and schedules; Settings turns the reminder off through it too.
 * Signing out, or another account signing in, cancels every pending line
 * (`stopReminders`, from `App.tsx`); signing in does not.
 *
 * Every plan it hands the OS is named, and the device remembers which one the
 * OS holds (`store.ts` `saveHeldPlan`). Whenever it takes a plan back it says
 * so first, so a log never counts a slot the OS no longer held as one that
 * arrived (`plan.ts` `replanStep`): a reminder turned off, refused or left
 * behind at a sign-out can never come back as a pause nobody earned.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { DEFAULT_TUTOR_VOICE, tutorVoice, type DayKey, type StreakCover } from '@luvani/core';

import { useProfile } from '../app/ProfileContext.tsx';
import { onSettled, readGameFacts } from '../game/settle.ts';
import { NO_OUTSIDE_FACTS, finishedSittings } from '../game/view.ts';
import { guestPracticeDays } from '../onboarding/guestModel.ts';
import { loadGuestPractice } from '../onboarding/guestPractice.ts';
import { loadPreAccountDraft, type PreAccountOnboardingDraft } from '../onboarding/preAccountDraft.ts';
import { loadProfile } from '../profile/store.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { tutorNameOf } from '../tutor/tutorName.ts';
import { acceptReminderOffer } from '../live/keepsake.ts';
import { reminderOpenOf, routeForReminder, type ReminderRoute } from './openTarget.ts';
import { todayPhraseId } from './todayPhrase.ts';
import {
  LOCAL_CALENDAR,
  closeLog,
  emptyLog,
  noteAnswered,
  noteOpened,
  planReminders,
  plannedLog,
  replanStep,
  slotDay,
  smartTime,
  type ReminderLog,
  type ReminderSlot,
} from './plan.ts';
import { DEFAULT_REMINDER_TIME, type ClockTime, type ReminderMode, type StoredReminder } from './reminder.ts';
import {
  REMINDERS_AVAILABLE,
  askReminderPermission,
  cancelReminder,
  onReminderTapped,
  reminderPermission,
  schedulePlan,
  type ScheduleOutcome,
} from './schedule.ts';
import type { PersistAck } from '../storage/ack.ts';
import {
  clearGuestReminderLog,
  loadGuestReminderLog,
  loadHeldPlan,
  loadReminder,
  loadReminderLog,
  saveGuestReminderLog,
  saveHeldPlan,
  saveReminder,
  saveReminderLog,
} from './store.ts';

/** What one re-plan may be handed instead of reading it. */
export interface ReplanOptions {
  /** The choice to plan for, when the caller has just decided it (Settings, the ask). */
  choice?: StoredReminder;
  /** The tutor the lines name, when the caller holds it. */
  tutor?: string;
  /** A guest's draft newer than the disk's. */
  draft?: PreAccountOnboardingDraft | null;
  /** A guest said yes again: their reminder starts afresh, unpaused. */
  resume?: boolean;
}

/** The practice facts the plan reads. */
interface PracticeFacts {
  practiceDays: readonly DayKey[];
  covers: readonly StreakCover[];
  finishes: readonly number[];
}

let chain: Promise<unknown> = Promise.resolve();

/** Run planner work alone, in the order it was asked for. */
function alone<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work);
  chain = next.catch(() => {});
  return next;
}

/** An account's facts, through the game layer. Null when they cannot be read. */
async function accountFacts(): Promise<PracticeFacts | null> {
  try {
    const facts = await readGameFacts(NO_OUTSIDE_FACTS, null);
    return { practiceDays: facts.practiceDays, covers: facts.game.covers, finishes: finishedSittings(facts).map((sitting) => sitting.at) };
  } catch {
    return null;
  }
}

/** A guest's facts: the days a practice was saved as finished, and nothing else. */
async function guestFacts(): Promise<PracticeFacts> {
  const guest = await loadGuestPractice();
  return { practiceDays: guestPracticeDays(guest), covers: [], finishes: guest?.finishedAt ?? [] };
}

/** True while the app is on screen: a re-plan now is a visit. */
function visiting(): boolean {
  return AppState.currentState === 'active';
}

/**
 * Take the plan back from the OS. The held plan is cleared first, so if
 * anything after it fails no log can count what the OS no longer holds; then
 * the closed log is written; then the OS lets go of this app's slots.
 */
async function takeBack(held: number | null, record: () => Promise<unknown>): Promise<ScheduleOutcome> {
  if (held !== null) await saveHeldPlan(null);
  await record();
  return cancelReminder();
}

/**
 * Hand `slots` to the OS in place of whatever it held, and write down that it
 * did. The held plan is cleared before the OS is touched and named after the
 * log is written, so a crash between the two can only make the log count too
 * little. A refusal leaves the OS holding nothing, and the log says so.
 */
async function handOver(slots: readonly ReminderSlot[], log: ReminderLog, now: number, record: (log: ReminderLog) => Promise<PersistAck>): Promise<ScheduleOutcome> {
  await saveHeldPlan(null);
  const outcome = await schedulePlan(slots);
  if (outcome !== 'done') {
    await record(closeLog(log, now));
    return outcome;
  }
  if ((await record(plannedLog(log, slots, now))) === 'durable') await saveHeldPlan(now);
  return outcome;
}

async function replanAccount(options: ReplanOptions): Promise<ScheduleOutcome> {
  const owner = scopeGeneration();
  const live = () => owner === scopeGeneration();
  // An account plans now; the guest's log has nothing left to say.
  void clearGuestReminderLog();
  let choice: StoredReminder | null = options.choice ?? null;
  if (options.choice === undefined) {
    try {
      choice = await loadReminder({ strict: true });
    } catch {
      // Unknown is not off: the OS keeps what it holds until the choice can be read.
      return 'failed';
    }
  }
  if (!live()) return 'failed';
  const wanted = choice !== null && choice.enabled && choice.paused !== true;
  const permitted = wanted && (await reminderPermission()) === 'granted';
  const now = Date.now();
  const [stored, held] = await Promise.all([loadReminderLog(), loadHeldPlan()]);
  if (!live()) return 'failed';
  // Off, paused, not allowed, or the pause note has gone out: the plan comes
  // back from the OS. A choice the caller has just made is a turning on, so it
  // is never read as a pause.
  const step = replanStep({ now, choice, chosenNow: options.choice !== undefined, permitted, log: stored, held });
  if (step.kind === 'take-back') {
    if (step.pause && choice !== null) await saveReminder({ ...choice, paused: true });
    const changed = stored.slots.length > 0 || stored.plannedAt !== undefined;
    return takeBack(held, () => (changed && live() ? saveReminderLog(step.log) : Promise.resolve()));
  }
  if (choice === null) return 'failed';

  const facts = await accountFacts();
  const tutor = options.tutor ?? tutorNameOf(await loadProfile().catch(() => null));
  let log: ReminderLog = step.log;
  if (visiting()) log = noteOpened(log, now, LOCAL_CALENDAR);
  const slots = planReminders({
    now,
    calendar: LOCAL_CALENDAR,
    choice,
    finishes: facts?.finishes ?? [],
    practiceDays: facts?.practiceDays ?? [],
    covers: facts?.covers ?? [],
    tutor,
    log,
    todayUnknown: facts === null,
  });
  if (!live()) return 'failed';
  return handOver(slots, log, now, (next) => (live() ? saveReminderLog(next) : Promise.resolve('failed' as const)));
}

async function replanGuest(options: ReplanOptions): Promise<ScheduleOutcome> {
  const draft = options.draft !== undefined ? options.draft : await loadPreAccountDraft().catch(() => null);
  const choice: StoredReminder | null =
    options.choice ??
    (draft?.reminderEnabled === true
      ? { enabled: true, time: draft.reminderTime ?? DEFAULT_REMINDER_TIME, ...(draft.reminderDays?.length ? { days: draft.reminderDays } : {}) }
      : null);
  const held = await loadHeldPlan();
  if (choice === null || !choice.enabled) return takeBack(held, () => clearGuestReminderLog());

  const resume = options.resume === true;
  // A guest said yes again: their reminder starts afresh, unpaused.
  const guest = resume ? { paused: false, log: emptyLog() } : await loadGuestReminderLog();
  const permitted = (await reminderPermission()) === 'granted';
  const now = Date.now();
  const step = replanStep({ now, choice: { ...choice, paused: guest.paused }, chosenNow: resume, permitted, log: guest.log, held });
  if (step.kind === 'take-back') return takeBack(held, () => saveGuestReminderLog({ paused: guest.paused || step.pause, log: step.log }));

  const facts = await guestFacts();
  // The tutor the first run named: the one in the draft, as the ask names it.
  const tutor = options.tutor ?? tutorVoice(draft?.tutorVoice ?? DEFAULT_TUTOR_VOICE).persona.name;
  let log = step.log;
  if (visiting()) log = noteOpened(log, now, LOCAL_CALENDAR);
  const slots = planReminders({ now, calendar: LOCAL_CALENDAR, choice, ...facts, tutor, log, guest: true });
  // An account appeared while this was read: its own planner plans now.
  if (activeUserId() !== null) return 'failed';
  return handOver(slots, log, now, (next) => saveGuestReminderLog({ paused: false, log: next }));
}

/**
 * Plan the reminder again from what is true now: the account's when somebody
 * is signed in, the guest's otherwise. `unavailable` on a build with no
 * scheduler; `failed` when the choice could not be read or the OS refused.
 */
export function replanReminders(options: ReplanOptions = {}): Promise<ScheduleOutcome> {
  if (!REMINDERS_AVAILABLE) return Promise.resolve('unavailable');
  return alone(() => (activeUserId() === null ? replanGuest(options) : replanAccount(options)));
}

/**
 * The learner said yes on the ask, and the OS has already allowed it. For an
 * account the choice is saved and then planned, and put back as it was if the
 * OS will not take it (`acceptReminderOffer`); for a guest it is planned from the
 * guest's finish days, and the first run records the answer in its draft.
 * `done` only once the OS took the plan.
 */
export async function turnOnReminder(time: ReminderMode, tutor: string): Promise<ScheduleOutcome> {
  if (activeUserId() === null) return replanReminders({ choice: { enabled: true, time }, tutor, resume: true });
  const owner = scopeGeneration();
  let stored: StoredReminder | null;
  try {
    stored = await loadReminder({ strict: true });
  } catch {
    return 'failed';
  }
  // The yes, as it is written: the learner's other choices kept, unpaused.
  const yes = (mode: ReminderMode): StoredReminder => ({ ...(stored ?? {}), enabled: true, time: mode, paused: false });
  const answer = await acceptReminderOffer(
    { choice: time, asks: false },
    {
      owns: () => owner === scopeGeneration(),
      ask: askReminderPermission,
      read: reminderPermission,
      // A yes is written over what was there, and the put-back after the OS
      // refused the plan restores exactly that: the ask can never turn off a
      // reminder the learner had chosen.
      save: (reminder) => (reminder.enabled ? saveReminder(yes(reminder.time)) : saveReminder(stored ?? reminder)),
      // Planned for the choice just written, so a fresh yes is never read as a pause.
      schedule: (mode) => replanReminders({ tutor, choice: yes(mode) }),
    },
  );
  return answer === 'on' ? 'done' : 'failed';
}

/** The learner's own time as the smart mode reads it now, or null until their rhythm shows. */
export async function smartReminderTime(): Promise<ClockTime | null> {
  const now = Date.now();
  const facts = activeUserId() === null ? await guestFacts().catch(() => null) : await accountFacts();
  return facts === null ? null : smartTime(facts.finishes, now, LOCAL_CALENDAR);
}

/** A reminder was tapped: its day is answered, which is what keeps the reminder from pausing. */
export function noteReminderTap(id: string): Promise<void> {
  const day = slotDay(id);
  if (day === null) return Promise.resolve();
  return alone(async () => {
    if (activeUserId() === null) {
      const held = await loadGuestReminderLog();
      await saveGuestReminderLog({ ...held, log: noteAnswered(held.log, day) });
      return;
    }
    await saveReminderLog(noteAnswered(await loadReminderLog(), day));
  }).catch(() => {});
}

/**
 * Signing out, or another account signing in: every pending line leaves with
 * the account. The account's own log can no longer be written by then, so the
 * held plan is what says its slots are gone. Nothing else calls this.
 */
export function stopReminders(): Promise<ScheduleOutcome> {
  if (!REMINDERS_AVAILABLE) return Promise.resolve('unavailable');
  return alone(async () => {
    await saveHeldPlan(null);
    return cancelReminder();
  });
}

/** Whether a change of app state is one worth re-planning for. */
function replansOn(state: string): boolean {
  return state === 'active' || state === 'background';
}

/** The account's planner, mounted once inside the signed-in tree, after the guest hand-off. */
export function ReminderPlanner(): null {
  const { profile } = useProfile();
  const tutor = tutorNameOf(profile);
  const tutorRef = useRef(tutor);
  tutorRef.current = tutor;
  // On mount, and again whenever the chosen tutor changes.
  useEffect(() => {
    void replanReminders({ tutor });
  }, [tutor]);
  useEffect(() => {
    const offSettled = onSettled(() => {
      void replanReminders({ tutor: tutorRef.current });
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (replansOn(state)) void replanReminders({ tutor: tutorRef.current });
    });
    return () => {
      offSettled();
      appState.remove();
    };
  }, []);
  return null;
}

/**
 * The guest's planner, mounted while nobody is signed in. The first run's draft
 * moves the moment a finished practice is on the disk (it turns to day one), so
 * re-planning on the draft is what skips the day a guest practised.
 */
export function GuestReminderPlanner({ draft }: { draft: PreAccountOnboardingDraft | null }): null {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const moved = JSON.stringify([draft?.reminderEnabled ?? false, draft?.reminderTime ?? null, draft?.reminderDays ?? [], draft?.tutorVoice ?? null, draft?.page ?? null]);
  useEffect(() => {
    void replanReminders({ draft: draftRef.current });
  }, [moved]);
  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => {
      if (replansOn(state)) void replanReminders({ draft: draftRef.current });
    });
    const offTaps = onReminderTapped((_open, id) => {
      void noteReminderTap(id);
    });
    return () => {
      appState.remove();
      offTaps();
    };
  }, []);
  return null;
}

/** The root navigator, as much of it as a tap needs. */
interface TapNavigator {
  isReady(): boolean;
  dispatch(action: ReturnType<typeof CommonActions.navigate>): void;
  addListener(type: 'ready', callback: () => void): () => void;
}

/**
 * Taps on a reminder, for the signed-in tree: the day is answered, and the tap
 * opens the place its line promised. A tap that arrives before the navigator
 * is ready (the one that launched the app from cold) waits, and is followed
 * the moment the navigator says it is ready.
 */
export function useReminderTaps(navigation: TapNavigator): void {
  const pending = useRef<ReminderRoute | null>(null);
  const follow = useCallback(() => {
    const route = pending.current;
    if (route === null || !navigation.isReady()) return;
    pending.current = null;
    navigation.dispatch(CommonActions.navigate(route));
  }, [navigation]);
  useEffect(() => navigation.addListener('ready', follow), [navigation, follow]);
  useEffect(
    () =>
      onReminderTapped((open, id) => {
        void noteReminderTap(id);
        const target = reminderOpenOf(open);
        // Today's phrase as Home shows it, worked out at the tap, so it is today's whenever the tap comes.
        const today = target === 'daily-phrase' ? todayPhraseId(Date.now()).catch(() => null) : Promise.resolve(null);
        void today.then((phraseId) => {
          pending.current = routeForReminder(target, phraseId);
          follow();
        });
      }),
    [follow],
  );
}
